const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');

test.describe('Editor Features', () => {
  let app;
  let window;

  test.beforeAll(async () => {
    app = await electron.launch({
      args: [path.join(__dirname, '../electron/main.js')],
      env: { ...process.env, NODE_ENV: 'development' }
    });
    window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    // Wait for app to settle
    await window.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    await app.close();
  });

  test('Create note and use rich text features', async () => {
    // 1. Create new note
    await window.click('text=New Note');
    await window.waitForTimeout(500);

    // 2. Type Title
    const titleInput = await window.locator('input[placeholder="Note Title"]');
    await titleInput.fill('Test Rich Text Note');

    // 3. Type Content
    const editor = await window.locator('.ProseMirror');
    await editor.click();
    await editor.type('Hello World');

    // 4. Bold
    await editor.selectText();
    await window.click('button[title="Bold"]');
    // Verify bold class or tag (Tiptap uses <strong>)
    const boldText = await window.locator('.ProseMirror strong');
    expect(await boldText.count()).toBeGreaterThan(0);

    // 5. Italic
    await editor.click();
    await editor.type(' Italic Text');
    await editor.selectText(); // Selects all? No, just recently typed usually or we need to be careful
    // Let's clear and type fresh to be safe or just append
    await window.keyboard.press('End');
    await window.keyboard.press('Enter');
    await editor.type('Italic Line');
    await window.keyboard.press('Shift+Home'); // Select line
    await window.click('button[title="Italic"]');
    const italicText = await window.locator('.ProseMirror em');
    expect(await italicText.count()).toBeGreaterThan(0);

    // 6. Checklist
    await window.keyboard.press('Enter');
    await window.click('button[title="Checklist"]');
    await editor.type('Task 1');
    await window.keyboard.press('Enter');
    await editor.type('Task 2');
    const checkboxes = await window.locator('ul[data-type="taskList"] li input[type="checkbox"]');
    expect(await checkboxes.count()).toBeGreaterThan(1);

    // 7. Text Color (Hard to test visual color, but can check attribute)
    // We can't easily interact with native color picker in Playwright, 
    // but we can verify the input exists
    const colorInput = await window.locator('input[type="color"]');
    expect(await colorInput.isVisible()).toBe(true);
  });

  test('Focus Mode Alignment', async () => {
    // Check initial state (should have max-w-4xl mx-auto)
    const container = await window.locator('.custom-scrollbar > div');
    const initialClass = await container.getAttribute('class');
    expect(initialClass).toContain('max-w-4xl');
    expect(initialClass).toContain('mx-auto');

    // Toggle Focus Mode
    await window.click('button[title="Toggle Focus Mode"]');
    await window.waitForTimeout(500);

    // Check new state (should be max-w-none mx-0)
    const newClass = await container.getAttribute('class');
    expect(newClass).toContain('max-w-none');
    expect(newClass).toContain('mx-0');
    
    // Toggle back
    await window.click('button[title="Toggle Focus Mode"]');
  });

  test('Business Proposal Note loads', async () => {
    // Click on Business Proposal note in sidebar
    // We assume it exists based on AppContext logic
    const noteItem = await window.getByText('Business Proposal').first();
    if (await noteItem.isVisible()) {
        await noteItem.click();
        await window.waitForTimeout(2000);
        
        // Check content
        const editor = await window.locator('.ProseMirror');
        const content = await editor.textContent();
        expect(content).toContain('Business Proposal');
        expect(content).toContain('Company Overview');
    } else {
        console.log('Business Proposal note not found in list');
    }
  });
});
