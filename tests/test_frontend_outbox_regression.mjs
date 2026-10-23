import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';

const src = fs.readFileSync('frontend/app.js', 'utf8');
const start = src.indexOf('async function flushPendingExamSubmissions()');
const end = src.indexOf('if (typeof window !== "undefined")', start);
if (start < 0 || end < 0) throw new Error('Function flushPendingExamSubmissions not found in frontend/app.js');
const fnCode = src.slice(start, end);

async function runScenario({ initialQueue, mockResponses, mode }) {
  let storageVal = JSON.stringify(initialQueue);
  const sentRequests = [];
  const firebaseSyncCalls = [];

  const ctx = {
    studentAuthState: { uid: 'AUDIT', token: 'TOKEN_AUDIT' },
    navigator: { onLine: true },
    getExamApiRoot: () => '/api',
    localStorage: {
      getItem: () => storageVal,
      setItem: (k, v) => { storageVal = v; }
    },
    syncSubmissionToFirebase: async (item, evalData) => {
      firebaseSyncCalls.push({ item, evalData, currentUid: ctx.studentAuthState.uid });
      return true;
    },
    fetch: async (url, opts) => {
      const parsedBody = JSON.parse(opts.body);
      sentRequests.push({ url, body: parsedBody, headers: opts.headers });

      if (mode === 'concurrent_add_B') {
        const currentItems = JSON.parse(storageVal);
        currentItems.push({ student_id: 'AUDIT', exam_id: 'e2', submission_id: 'b' });
        storageVal = JSON.stringify(currentItems);
      }
      if (mode === 'switch_user') {
        ctx.studentAuthState = { uid: 'OTHER', token: 'TOKEN_OTHER' };
      }

      const resp = mockResponses[sentRequests.length - 1] || mockResponses[0];
      return {
        ok: true,
        json: async () => resp
      };
    }
  };

  vm.createContext(ctx);
  vm.runInContext(fnCode, ctx);
  await ctx.flushPendingExamSubmissions();

  const finalQueue = JSON.parse(storageVal);
  const lockReleased = ctx.flushPendingExamSubmissions._isRunning === false;

  return {
    finalQueue,
    sentRequests,
    firebaseSyncCalls,
    lockReleased
  };
}

const itemA = { student_id: 'AUDIT', exam_id: 'e1', submission_id: 'a' };
const itemB = { student_id: 'AUDIT', exam_id: 'e2', submission_id: 'b' };
const validEval = { score: 10, correct_count: 1, total_questions: 1, submitted_at: '2026-10-23T00:00:00', details: [] };

async function runAllTests() {
  console.log("Running Frontend Outbox Regression Tests (D01 & D02)...");

  // 1. D01: Empty evaluation object {} must be rejected, retaining item in queue
  {
    const res = await runScenario({
      initialQueue: [itemA],
      mockResponses: [{ success: true, evaluation: {} }],
      mode: 'normal'
    });
    assert.strictEqual(res.finalQueue.some(x => x.submission_id === 'a'), true, "D01 FAIL: Empty evaluation {} must retain item in queue");
    assert.strictEqual(res.lockReleased, true, "Lock must be released");
    console.log("  [PASS] 1. D01_empty_evaluation_rejected");
  }

  // 2. D01: Array evaluation [] must be rejected, retaining item in queue
  {
    const res = await runScenario({
      initialQueue: [itemA],
      mockResponses: [{ success: true, evaluation: [] }],
      mode: 'normal'
    });
    assert.strictEqual(res.finalQueue.some(x => x.submission_id === 'a'), true, "D01 FAIL: Array evaluation [] must retain item in queue");
    assert.strictEqual(res.lockReleased, true, "Lock must be released");
    console.log("  [PASS] 2. D01_array_evaluation_rejected");
  }

  // 3. D01: Missing required fields or wrong type (score string) must be rejected
  {
    const res = await runScenario({
      initialQueue: [itemA],
      mockResponses: [{ success: true, evaluation: { score: "10", total_questions: "1" } }],
      mode: 'normal'
    });
    assert.strictEqual(res.finalQueue.some(x => x.submission_id === 'a'), true, "D01 FAIL: Wrong field types must retain item in queue");
    assert.strictEqual(res.lockReleased, true, "Lock must be released");
    console.log("  [PASS] 3. D01_wrong_type_rejected");
  }

  // 4. D01: Valid evaluation contract must ACK and remove item from queue
  {
    const res = await runScenario({
      initialQueue: [itemA],
      mockResponses: [{ success: true, evaluation: validEval }],
      mode: 'normal'
    });
    assert.strictEqual(res.finalQueue.some(x => x.submission_id === 'a'), false, "D01 FAIL: Valid evaluation must remove item from queue");
    assert.strictEqual(res.firebaseSyncCalls.length, 1, "Firebase sync must be called for valid ACK");
    assert.strictEqual(res.lockReleased, true, "Lock must be released");
    console.log("  [PASS] 4. D01_valid_evaluation_accepted");
  }

  // 5. D02: Adding item B while item A is inflight must NEVER lose item B
  {
    const res = await runScenario({
      initialQueue: [itemA],
      mockResponses: [{ success: true, evaluation: validEval }],
      mode: 'concurrent_add_B'
    });
    assert.strictEqual(res.finalQueue.some(x => x.submission_id === 'a'), false, "A should be removed after valid ACK");
    assert.strictEqual(res.finalQueue.some(x => x.submission_id === 'b'), true, "B added concurrently must be preserved in queue");
    assert.strictEqual(res.lockReleased, true, "Lock must be released");
    console.log("  [PASS] 5. D02_concurrent_B_preserved");
  }

  // 6. D02: Switching account while item A is inflight:
  //    - Item B of old user must NOT be sent
  //    - Item B must remain in queue
  //    - Late response of A must NOT sync/update UI for the newly switched user
  {
    const res = await runScenario({
      initialQueue: [itemA, itemB],
      mockResponses: [{ success: true, evaluation: validEval }],
      mode: 'switch_user'
    });
    assert.strictEqual(res.sentRequests.length, 1, "D02 FAIL: Must abort flush loop and not send item B of old user");
    assert.strictEqual(res.sentRequests[0].body.submission_id, 'a');
    assert.strictEqual(res.finalQueue.some(x => x.submission_id === 'b'), true, "D02 FAIL: Item B must remain in queue");
    assert.strictEqual(res.firebaseSyncCalls.length, 0, "D02 FAIL: Late response of A must not sync/update state of newly switched user");
    assert.strictEqual(res.lockReleased, true, "Lock must be released");
    console.log("  [PASS] 6. D02_account_switch_aborts_B_and_protects_new_user");
  }

  console.log("\nALL 6 FRONTEND REGRESSION SCENARIOS PASSED (100%)!\n");
}

runAllTests().catch(err => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
