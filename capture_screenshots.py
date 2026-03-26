"""Capture demo screenshots of JudiciAI app using Playwright."""
from playwright.sync_api import sync_playwright
import time

FRAMES_DIR = "/Users/murchewings/Projects/evidence-agent/demo-frames"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})

    # Frame 1: Landing page
    page.goto("http://localhost:3001", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)  # Wait for Tailwind CDN to process
    page.screenshot(path=f"{FRAMES_DIR}/01_landing.png")
    print("01_landing.png captured")

    # Frame 2: Click "Keto can lower your cholesterol" example
    page.click('button:has-text("Keto can lower your cholesterol")')
    page.wait_for_timeout(500)
    page.screenshot(path=f"{FRAMES_DIR}/02_claim_entered.png")
    print("02_claim_entered.png captured")

    # Frame 3: Click verify and wait for results
    page.click('button:has-text("Verify Claim")')
    # Wait for verdict to appear (up to 30s for API call)
    try:
        page.wait_for_selector("#verdictLabel", state="visible", timeout=30000)
        page.wait_for_timeout(1000)  # Let animations settle
    except:
        page.wait_for_timeout(5000)  # Fallback wait
    page.screenshot(path=f"{FRAMES_DIR}/03_verdict.png")
    print("03_verdict.png captured")

    # Frame 4: Scroll down to see sources
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(500)
    page.screenshot(path=f"{FRAMES_DIR}/04_sources.png")
    print("04_sources.png captured")

    # Frame 5: Scroll back up, click bull case if visible
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
    page.screenshot(path=f"{FRAMES_DIR}/05_bull_case.png")
    print("05_bull_case.png captured")

    # Frame 6: Click bear case if visible
    bear_btn = page.query_selector('button:has-text("Bear")')
    if bear_btn:
        bear_btn.click()
        try:
            page.wait_for_selector("#bearContent", state="visible", timeout=15000)
            page.wait_for_timeout(1000)
        except:
            page.wait_for_timeout(3000)
    page.screenshot(path=f"{FRAMES_DIR}/06_bear_case.png")
    print("06_bear_case.png captured")

    browser.close()
    print("All screenshots captured!")
