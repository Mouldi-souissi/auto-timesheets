// Fieldglass Time Sheet Automation Script
// Run with: npm start
// Or directly: node main.js
// Make sure to set USERNAME and PASSWORD in .env file or environment variables

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Load environment variables manually to avoid dotenv parsing issues on Windows
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split(/\r?\n/); // Handle both \n and \r\n
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          process.env[key.trim()] = value;
        }
      }
    });
  }
}

// Load the .env file
loadEnvFile();

// Load credentials from environment variables
const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;

async function login(page, username, password) {
  // Navigate to login page
  console.log('Navigating to Fieldglass login...');
  await page.goto('https://www.us.fieldglass.cloud.sap/?next=%2Fworker_desktop.do', { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  console.log('Current URL:', page.url());
  console.log('Page title:', await page.title());
  
  // Handle cookie consent popup - click "Deny All"
  console.log('Checking for cookie consent popup...');
  try {
    await page.waitForSelector('#truste-consent-required', { timeout: 5000 });
    console.log('Cookie consent popup found. Clicking "Deny All"...');
    await page.click('#truste-consent-required');
  } catch (e) {
    console.log('Cookie consent popup not found or already dismissed');
  }
  
  // Wait for username field to be visible
  console.log('Waiting for username field...');
  await page.waitForSelector('#usernameId_new', { timeout: 10000 });
  
  // Fill username and password fields
  console.log('Filling username field...');
  await page.fill('#usernameId_new', username);
  
  console.log('Filling password field...');
  await page.fill('#passwordId_new', password);
  
  // Click Sign In button
  console.log('Clicking Sign In button...');
  await page.click('.formLoginButton_new');
  
  // Wait for successful login - check for either the worker desktop URL or navigation sidebar
  console.log('Waiting for login to complete...');
  try {
    // Wait for either the worker desktop URL or the navigation sidebar to appear
    await Promise.race([
      page.waitForURL('**/worker_desktop.do', { timeout: 30000 }),
      page.waitForSelector('#viewMenu_3_timeAndExpense_header', { timeout: 30000 })
    ]);
    console.log('Login successful - page loaded');
  } catch (e) {
    console.log('Login timeout - checking current state...');
    // Check if we're already on the worker desktop
    const currentURL = page.url();
    if (currentURL.includes('worker_desktop.do')) {
      console.log('Already on worker desktop');
    } else {
      throw new Error('Login failed - not on expected page');
    }
  }
  
  console.log('Login process completed');
  console.log('Final URL:', page.url());
}

async function navigateToTimeSheets(page) {
  // Immediately check for navigation sidebar after login
  console.log('Waiting for navigation sidebar to load...');
  await page.waitForSelector('#viewMenu_3_timeAndExpense_header', { timeout: 30000 });
  console.log('Navigation sidebar loaded, proceeding with navigation...');
  
  // Navigate to Time & Expense tab
  console.log('Navigating to Time & Expense tab...');
  await page.click('#viewMenu_3_timeAndExpense_header');
  
  // Wait for Time Sheets sub-item and click it
  console.log('Clicking Time Sheets...');
  await page.waitForSelector('#viewMenu_3_timeAndExpense_header-time-sheets', { timeout: 10000 });
  await page.click('#viewMenu_3_timeAndExpense_header-time-sheets');
  
  // Wait for the time sheets page to load
  console.log('Waiting for Time Sheets page to load...');
  await page.waitForSelector('#timeSheet_worker_list', { timeout: 30000 });
}

async function selectTimeSheet(page) {
  // Click on the ID column of the first row (Draft status)
  console.log('Clicking on the first row ID (Draft status)...');
  // The first row ID link should be the archiveLink in the first row
  await page.waitForSelector('.archiveLink', { timeout: 10000 });
  await page.click('.archiveLink:first-of-type');
  
  console.log('Navigation to time sheet detail completed');
}

async function editTimeSheet(page) {
  // Wait for the time sheet detail page to load and click Edit
  console.log('Waiting for time sheet detail page to load...');
  const editButton = page.getByRole('button', { name: 'Edit', exact: true });
  await editButton.waitFor({ state: 'visible', timeout: 10000 });
  
  console.log('Clicking Edit button...');
  await editButton.click();
  
  // Wait for the edit form to load
  console.log('Waiting for edit form to load...');
  await page.waitForSelector('.hour.timeEntry:not(.nonWorkingDay)', { timeout: 10000 });
}

async function fillHours(page) {
  // Fill 8 hours for all working days (Monday through Friday)
  console.log('Filling 8 hours for all working days...');
  const workingDayHourInputs = await page.$$('.hour.timeEntry:not(.nonWorkingDay)');
  
  for (const input of workingDayHourInputs) {
    await input.fill('8');
    console.log('Filled 8 hours for a working day');
  }
  
  console.log('Time entry completed - 8 hours filled for all working days');
}

async function submitTimeSheet(page) {
  // Click the Submit button
  console.log('Clicking Submit button...');
  await page.waitForSelector('#fgTSSubmit', { timeout: 5000 });
  await page.click('#fgTSSubmit');
  
  // Wait for the confirmation modal to appear and click Submit again
  console.log('Waiting for confirmation modal...');
  await page.waitForSelector('#modalPanel #update', { timeout: 10000 });
  
  console.log('Clicking Submit in confirmation modal...');
  await page.click('#modalPanel #update');
  
  console.log('Time sheet submission completed');
}

async function fillTimeSheet(page) {
  await navigateToTimeSheets(page);
  await selectTimeSheet(page);
  await editTimeSheet(page);
  await fillHours(page);
  await submitTimeSheet(page);
}

// Main execution block - runs when file is executed directly
if (require.main === module) {
  (async () => {
    try {
      console.log('Starting Fieldglass Time Sheet Automation...');
      console.log('Raw USERNAME from env:', JSON.stringify(process.env.USERNAME));
      console.log('Raw PASSWORD from env:', JSON.stringify(process.env.PASSWORD));
      console.log('Loaded USERNAME:', USERNAME);
      console.log('Loaded PASSWORD length:', PASSWORD ? PASSWORD.length : 0);

      if (!USERNAME || !PASSWORD) {
        console.error('Error: USERNAME and PASSWORD environment variables are required');
        console.error('Please set them in your .env file or environment');
        process.exit(1);
      }

      console.log('Starting Playwright script with login...');
      console.log('Username:', USERNAME);
      console.log('Password length:', PASSWORD ? PASSWORD.length : 0);

      const browser = await chromium.launch({ headless: false });
      const page = await browser.newPage();

      await login(page, USERNAME, PASSWORD);
      await fillTimeSheet(page);

      // Keep browser open for 30 seconds to allow manual inspection
      setTimeout(() => browser.close(), 5000);
      // browser.close();

      console.log('Automation completed successfully!');
      console.log('Result:', {
        success: true,
        message: 'Automation completed successfully',
        url: page.url()
      });
    } catch (error) {
      console.error('Automation failed:', error.message);
      process.exit(1);
    }
  })();
}