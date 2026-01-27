const { _electron: electron } = require('playwright');
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('NoteQ E2E', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../electron/main.js')],
      env: { ...process.env, PLAYWRIGHT_TEST: 'true' }
    });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should launch application', async () => {
    const title = await window.title();
    // Electron app title might default to "Electron" or be set in main.js
    // I didn't explicitly set title in main.js, so it might be "Electron" or loaded from HTML title "NoteQ"
    // Let's check if it contains NoteQ
    expect(title).toBe('NoteQ'); 
  });

  test('should display sidebar and notes list', async () => {
    // Check for Sidebar
    // await expect(window.locator('text=Isabella Ray')).toBeVisible(); // User removed
    // Check for Logo (via alt text if possible, or just skip user check)
    
    // Check for Categories in Sidebar
    // Scoping to sidebar container
    const sidebar = window.locator('[data-testid="sidebar"]');
    await expect(sidebar.locator('text=All')).toBeVisible();

    // Check for Notes List
    await expect(window.locator('text=New Note')).toBeVisible();
  });

  test('should create a new note', async () => {
    // Click Add Note
    await window.click('text=New Note');

    // Check if new note appears in list (Untitled Note)
    // Depending on state speed, it might take a moment
    await expect(window.locator('h4:has-text("Untitled Note")').first()).toBeVisible();
    
    // Check editor title input
    const titleInput = window.locator('input[placeholder="Note Title"]');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue('Untitled Note');
  });

  test('should edit note title', async () => {
    await window.click('text=New Note');
    const titleInput = window.locator('input[placeholder="Note Title"]');
    await titleInput.fill('My New Test Note');
    
    // Check if list updates
    await expect(window.locator('h4:has-text("My New Test Note")').first()).toBeVisible();
  });
});
