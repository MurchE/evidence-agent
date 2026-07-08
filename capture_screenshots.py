"""Capture demo screenshots of JudiciAI app using Playwright CDP."""
import base64
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

PROJECT_ROOT = Path(__file__).resolve().parent
FRAMES_DIR = Path(os.getenv("DEMO_FRAMES_DIR", PROJECT_ROOT / "demo-frames"))
FRONTEND_URL = os.getenv("DEMO_FRONTEND_URL", "http://127.0.0.1:3001/index_demo.html")

def take_cdp_screenshot(page, path):
    """Take screenshot via CDP to bypass font waiting."""
    cdp = page.context.new_cdp_session(page)
    result = cdp.send("Page.captureScreenshot", {"format": "png"})
    with open(path, "wb") as f:
        f.write(base64.b64decode(result["data"]))
    cdp.detach()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    # Use demo HTML with local Tailwind (headless Chromium has no internet)
    page.goto(FRONTEND_URL, wait_until="load", timeout=30000)
    page.wait_for_timeout(2000)
    ss_count = page.evaluate("() => document.styleSheets.length")
    has_body = page.evaluate("() => !!document.body")
    print(f"Stylesheets: {ss_count}, has body: {has_body}")
    take_cdp_screenshot(page, f"{FRAMES_DIR}/01_landing.png")
    print("01_landing.png captured")

    # Frame 2: Click "Keto can lower your cholesterol" example
    page.click('button:has-text("Keto can lower your cholesterol")')
    page.wait_for_timeout(500)
    take_cdp_screenshot(page, f"{FRAMES_DIR}/02_claim_entered.png")
    print("02_claim_entered.png captured")

    # Frame 3: Click verify and wait for results
    page.click('button:has-text("Verify Claim")')
    try:
        page.wait_for_selector("#verdictLabel", state="visible", timeout=30000)
        page.wait_for_timeout(1000)
    except:
        page.wait_for_timeout(5000)
    take_cdp_screenshot(page, f"{FRAMES_DIR}/03_verdict.png")
    print("03_verdict.png captured")

    # Frame 4: Scroll down to see sources
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(500)
    take_cdp_screenshot(page, f"{FRAMES_DIR}/04_sources.png")
    print("04_sources.png captured")

    # Frame 5: Scroll back up, click bull case
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(300)
    bull_btn = page.query_selector('button:has-text("Bull")')
    if bull_btn:
        bull_btn.click()
        try:
            page.wait_for_selector("#bullContent", state="visible", timeout=15000)
            page.wait_for_timeout(1000)
        except:
            page.wait_for_timeout(3000)
    take_cdp_screenshot(page, f"{FRAMES_DIR}/05_bull_case.png")
    print("05_bull_case.png captured")

    # Frame 6: Click bear case
    bear_btn = page.query_selector('button:has-text("Bear")')
    if bear_btn:
        bear_btn.click()
        try:
            page.wait_for_selector("#bearContent", state="visible", timeout=15000)
            page.wait_for_timeout(1000)
        except:
            page.wait_for_timeout(3000)
    take_cdp_screenshot(page, f"{FRAMES_DIR}/06_bear_case.png")
    print("06_bear_case.png captured")

    browser.close()
    print("All screenshots captured!")
