# Pathologist User Guide

Welcome to the WSI Viewer for pathologist user studies. This guide will help you navigate the system and complete your slide reviews.

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Navigation Controls](#navigation-controls)
4. [Workflow](#workflow)
5. [Progress Tracking](#progress-tracking)
6. [Troubleshooting](#troubleshooting)
7. [Privacy & Data](#privacy--data)

---

## Introduction

### Study Purpose

This application captures how pathologists examine whole slide images (WSIs) for research purposes. Your interaction data will help train machine learning models to understand visual search patterns and diagnostic decision-making.

### Time Commitment

- **Per Slide:** Approximately 5-10 minutes
- **Total Slides:** You will review a set number of slides (typically 20-50)
- **Sessions:** You can complete slides in multiple sessions - your progress is automatically saved

### What You'll Do

1. Examine each slide at multiple magnification levels
2. Navigate using click, pan, and zoom controls
3. Select a diagnosis (Normal, Benign, or Malignant)
4. Optionally add notes about your observations
5. Move to the next slide

---

## Getting Started

### Logging In

1. Open the viewer URL provided by your study coordinator
2. Enter your username and password (provided separately)
3. Click **Login**

> **Note:** For the best experience, please maximize your browser window before starting.

### Browser Requirements

- **Recommended:** Chrome, Firefox, or Edge (latest version)
- **Screen:** Laptop or desktop monitor (minimum 1920×1080 resolution recommended)
- **Internet:** Stable connection required for loading slides

---

## Navigation Controls

The viewer uses **discrete navigation** - you control exactly where you look and at what magnification.

### Zoom Levels

The viewer supports six magnification levels:

- **Fit** - Entire slide visible (overview)
- **2.5×** - Low magnification
- **5×** - Medium-low magnification
- **10×** - Medium magnification
- **20×** - Medium-high magnification
- **40×** - High magnification (maximum detail)

### Mouse Controls

#### Left Click - Zoom In
- **Action:** Click anywhere on the slide
- **Result:** Centers on that exact position and zooms in one level
- **Example:** Fit → 2.5× → 5× → 10× → 20× → 40×
- **At 40×:** Clicking recenters but doesn't zoom further (already at max)

#### Right Click - Zoom Out
- **Action:** Right-click anywhere on the slide
- **Result:** Zooms out one level while keeping the current center
- **Example:** 40× → 20× → 10× → 5× → 2.5× → Fit

### Arrow Buttons

Four arrow buttons appear at the edges of the viewer:

- **↑ Up** - Pan up by half a screen
- **↓ Down** - Pan down by half a screen
- **← Left** - Pan left by half a screen
- **→ Right** - Pan right by half a screen

> **Note:** Arrows are disabled when you can't pan further in that direction (at the edge of the slide).

### Navigation Buttons (Sidebar)

#### Back Button
- **Action:** Undo your last navigation step
- **Use Case:** Go back to where you were looking before
- **Example:** If you clicked somewhere by mistake, use Back to return

#### Reset Button
- **Action:** Return to the fit view (entire slide visible)
- **Use Case:** Start fresh from the overview

### Disabled Features

The following are intentionally disabled for this study:

- **Mouse wheel zoom** - Use click/right-click instead
- **Click-and-drag panning** - Use arrow buttons instead
- **Keyboard shortcuts** - All controls are on-screen

---

## Workflow

### Step-by-Step Process

#### 1. Overview the Slide

Start at the **Fit** view to see the entire slide:

- Identify regions of interest
- Plan your examination strategy
- Click on areas you want to examine closer

#### 2. Examine at Multiple Magnifications

Navigate through the slide systematically:

- **Low magnification (2.5×-5×):** Survey tissue architecture
- **Medium magnification (10×-20×):** Examine cellular details
- **High magnification (40×):** Confirm diagnostic features

> **Tip:** Use the zoom ladder naturally - click to zoom in on suspicious areas, right-click to zoom out for context.

#### 3. Select a Diagnosis

Once you've completed your examination:

1. Select one of the three diagnosis options in the sidebar:
   - **Normal** - No pathological findings
   - **Benign lesion** - Non-cancerous abnormality
   - **Malignant** - Cancerous tissue

2. **Optional:** Add notes in the text area below the diagnosis options
   - Describe key findings
   - Note any uncertainty
   - Add relevant observations

#### 4. Confirm and Move to Next Slide

1. Click **Confirm & Next** button
2. Your selection and notes are automatically saved
3. The next slide loads automatically
4. Your diagnosis selections cannot be changed once confirmed

### Completing the Study

When you finish all assigned slides:

- A **"Study Complete"** message will appear
- Thank you for your participation!
- You can safely close the browser

---

## Progress Tracking

### Progress Indicator

The top of the sidebar shows your current progress:

```
Progress: Slide 12/50
[████████░░░░░░░░░░] 24%
```

- **Current Slide:** Which slide you're on
- **Total Slides:** How many slides you need to complete
- **Progress Bar:** Visual representation of completion

### Resuming Sessions

You can log out and return later:

1. Click **Logout** button at the bottom of the sidebar
2. When you log back in, you'll resume at your next incomplete slide
3. All your previous diagnoses are saved

> **Note:** Each time you log in to view the same slide, it's treated as a separate viewing attempt for research purposes.

---

## Troubleshooting

### Slide Not Loading

**Symptoms:** Black screen, spinner keeps loading, or error message

**Solutions:**
1. **Check your internet connection** - Ensure you have stable connectivity
2. **Refresh the browser** - Press F5 or Ctrl+R (Cmd+R on Mac)
3. **Clear browser cache:**
   - Chrome: Settings → Privacy → Clear browsing data
   - Firefox: Preferences → Privacy → Clear Data
4. **Try a different browser** - Chrome or Firefox recommended
5. **Contact study coordinator** - If problems persist

### Controls Not Responding

**Symptoms:** Clicks don't work, buttons are grayed out

**Solutions:**
1. **Wait for slide to load completely** - Navigation is disabled until loading finishes
2. **Check arrow button availability:**
   - Grayed out arrows mean you're at the edge of the slide
   - Try different directions or zoom levels
3. **Refresh the page** - This resets the viewer state

### Session Expired Error

**Symptoms:** "Your session has expired. Please log in again."

**Solutions:**
1. **Log in again** - Click OK and return to login page
2. **Your progress is saved** - You won't lose any completed slides
3. **Security measure** - Sessions expire after 7 days of inactivity

### Unable to Connect

**Symptoms:** "Unable to connect. Please check your internet connection."

**Solutions:**
1. **Check internet connection** - Ensure you're online
2. **VPN issues** - If using VPN, try disconnecting/reconnecting
3. **Firewall** - Ensure your firewall isn't blocking the viewer
4. **Server maintenance** - Contact coordinator if the issue persists

### Accidentally Selected Wrong Diagnosis

**Important:** Once you click "Confirm & Next," your selection cannot be changed.

**If you haven't confirmed yet:**
- Simply select a different diagnosis option
- The last selection before clicking "Confirm & Next" is what gets saved

**If you already confirmed:**
- Unfortunately, the selection is final for that slide
- Continue with remaining slides as carefully as possible

### Browser Window Too Small

**Symptoms:** Prompt to maximize browser window

**Solutions:**
1. **Click maximize button** - Top-right corner of browser window
2. **Press F11** - Full-screen mode (press F11 again to exit)
3. **Adjust manually** - Drag window edges to fill screen

### Slow Performance

**Symptoms:** Sluggish navigation, delayed tile loading

**Solutions:**
1. **Close other browser tabs** - Free up memory
2. **Close other applications** - Reduce system load
3. **Check internet speed** - Slow connection affects tile loading
4. **Restart browser** - Clear accumulated memory

---

## Privacy & Data

### What Data Is Collected

The system records:

- **Navigation events:** Every click, pan, zoom, and navigation action
- **Viewport positions:** Where you were looking at each moment
- **Timestamps:** When each action occurred
- **Diagnosis selections:** Your final diagnosis for each slide
- **Optional notes:** Any text you enter in the notes field

### What Is NOT Collected

- **Personal information:** No names, email addresses, or personal identifiers
- **IP addresses:** Not stored with your interaction data
- **Other activities:** Only actions within this viewer are recorded

### Data Usage

All collected data is:

- **Anonymized:** Linked only to your study username (not your real identity)
- **Research-only:** Used exclusively for machine learning research
- **Secure:** Stored on encrypted servers with restricted access
- **Confidential:** Not shared outside the research team

### Your Rights

- You can request to see your collected data
- You can request deletion of your data (contact study coordinator)
- Participation is voluntary - you may withdraw at any time

### Questions or Concerns

Contact your study coordinator for:

- Questions about data collection
- Privacy concerns
- Technical support
- Withdrawal from the study

---

## Tips for Effective Use

### Best Practices

1. **Take your time** - There's no time limit per slide
2. **Use the full zoom range** - Don't rely only on high magnification
3. **Add notes when helpful** - Document your reasoning
4. **Log out between sessions** - Don't leave the page open indefinitely
5. **Maximize your window** - Better viewing experience

### Study Reminders

- **Natural workflow:** Examine slides as you normally would
- **No "correct" navigation** - We're studying YOUR process
- **Honest diagnoses:** Make your best assessment based on what you see
- **Optional notes:** Use them if they help, skip if not needed

---

## Support

### Getting Help

If you encounter issues not covered in this guide:

1. **Technical problems:** Contact study coordinator via provided email/phone
2. **Login issues:** Request password reset from coordinator
3. **System errors:** Note the error message and report it
4. **Questions about slides:** Follow your normal diagnostic process

### Study Coordinator Contact

**[Contact information will be provided separately by your study coordinator]**

---

Thank you for participating in this research study! Your contribution helps advance computational pathology and AI-assisted diagnostics.
