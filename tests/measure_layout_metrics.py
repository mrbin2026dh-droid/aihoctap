import json
import time
import sys
from playwright.sync_api import sync_playwright

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def measure():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for w, h in [(1366, 768), (1920, 1080)]:
            page = browser.new_page(viewport={"width": w, "height": h})
            page.goto("http://127.0.0.1:8000", wait_until="networkidle")
            time.sleep(1)
            
            data = page.evaluate("""() => {
                const sidebar = document.getElementById("roadmapSidebar");
                const canvas = document.getElementById("focusCanvas");
                const qCard = document.querySelector(".question-card");
                const qTitle = document.getElementById("questionTitle");
                const titleEl = document.querySelector(".sidebar-nav-title");
                const topRow = document.querySelector(".sidebar-nav-top-row");
                const titleRow = document.querySelector(".sidebar-nav-title-row");
                const actions = document.querySelector(".tree-quick-actions");
                
                const sbRect = sidebar ? sidebar.getBoundingClientRect() : null;
                const cvRect = canvas ? canvas.getBoundingClientRect() : null;
                const qcRect = qCard ? qCard.getBoundingClientRect() : null;
                const qtRect = qTitle ? qTitle.getBoundingClientRect() : null;
                const tRect = titleEl ? titleEl.getBoundingClientRect() : null;
                
                const qTitleStyle = qTitle ? window.getComputedStyle(qTitle) : null;
                const cvStyle = canvas ? window.getComputedStyle(canvas) : null;
                const qcStyle = qCard ? window.getComputedStyle(qCard) : null;
                
                // Gap between sidebar right edge and canvas / question card left edge
                const gapSidebarToCanvas = (cvRect && sbRect) ? (cvRect.left - sbRect.right) : 0;
                const gapSidebarToCard = (qcRect && sbRect) ? (qcRect.left - sbRect.right) : 0;
                
                // Check if title wraps
                const titleStyle = titleEl ? window.getComputedStyle(titleEl) : null;
                const titleLineHeight = parseFloat(titleStyle ? titleStyle.lineHeight : "20");
                const isTitleWrapped = tRect ? (tRect.height > titleLineHeight * 1.4) : false;
                
                return {
                    viewport: { width: window.innerWidth, height: window.innerHeight },
                    sidebar: { width: sbRect ? sbRect.width : 0, right: sbRect ? sbRect.right : 0 },
                    canvas: {
                        left: cvRect ? cvRect.left : 0,
                        width: cvRect ? cvRect.width : 0,
                        marginLeft: cvStyle ? cvStyle.marginLeft : "",
                        paddingLeft: cvStyle ? cvStyle.paddingLeft : "",
                        paddingTop: cvStyle ? cvStyle.paddingTop : ""
                    },
                    questionCard: {
                        left: qcRect ? qcRect.left : 0,
                        width: qcRect ? qcRect.width : 0,
                        padding: qcStyle ? qcStyle.padding : ""
                    },
                    gapSidebarToCard: gapSidebarToCard,
                    gapSidebarToCanvas: gapSidebarToCanvas,
                    h2QuestionTitle: {
                        fontSize: qTitleStyle ? qTitleStyle.fontSize : "",
                        marginTop: qTitleStyle ? qTitleStyle.marginTop : "",
                        marginBottom: qTitleStyle ? qTitleStyle.marginBottom : "",
                        lineHeight: qTitleStyle ? qTitleStyle.lineHeight : ""
                    },
                    sidebarTitle: {
                        text: titleEl ? titleEl.textContent : "",
                        height: tRect ? tRect.height : 0,
                        lineHeight: titleLineHeight,
                        isWrapped: isTitleWrapped
                    },
                    hasOverflow: document.body.scrollWidth > document.body.clientWidth
                };
            }""")
            print(f"=== Viewport {w}x{h} ===")
            print(json.dumps(data, indent=2, ensure_ascii=False))
        browser.close()

if __name__ == "__main__":
    measure()
