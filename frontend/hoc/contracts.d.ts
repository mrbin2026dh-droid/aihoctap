export interface Question { id: string; prompt: string; options: Record<string,string>; hint: string; kind: 'choice'|'text'; }
export interface Lesson { schema_version: 1; course_id: string; lesson_id: string; version: string; grading_revision?: string; title: string; content_markdown: string; questions: Question[]; }
export interface LessonSummary { id:string; title:string; version:string; question_count:number; }
export interface Course { id:string; subject_id:string; subject_name:string; grade:number; title:string; lessons:LessonSummary[]; }
export interface Catalog { schema_version:1; revision:string; courses:Course[]; }
export interface Identity { uid:string; student_name:string; grade:number; class_code:string; }
export interface AttemptBody { attempt_id:string; course_id:string; lesson_id:string; version:string; answers:Record<string,string>; }
export interface Ack { attempt_id:string; course_id:string; lesson_id:string; version:string; status:'submitted'; correct:number; total:number; score:number|null; needs_review:boolean; feedback:{id:string; correct:boolean|null; hint:string}[]; }
export interface Draft { key:string; uid:string; lesson:Lesson; answers:Record<string,string>; attempt_id:string; updated_at:number; }
export interface Outbox { key:string; uid:string; body:AttemptBody; created_at:number; ack?:Ack; error?:string; }
export interface PrivateQuestion extends Question { correct_answer:string; }
export interface PublishLesson { subject_id:string; subject_name:string; grade:number; lesson_id:string; title:string; content_markdown:string; questions:PrivateQuestion[]; }
export interface TutorResponse { reply:string; error:string|null; }

