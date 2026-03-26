/**
 * FirstLoginSetup.ts - First-login setup form for password and email
 */

export interface SetupFormData {
  email: string;
  newPassword: string;
  confirmPassword: string;
}

export class FirstLoginSetup {
  private container: HTMLElement;
  private onSuccess: () => void;
  
  constructor(onSuccess: () => void) {
    this.onSuccess = onSuccess;
    this.container = this.createSetupForm();
  }
  
  /**
   * Show the setup form
   */
  public show(): void {
    document.body.appendChild(this.container);
  }
  
  /**
   * Hide and remove the setup form
   */
  public hide(): void {
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
  
  /**
   * Create the setup form DOM
   */
  private createSetupForm(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'setup-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;
    
    const formContainer = document.createElement('div');
    formContainer.style.cssText = `
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      width: 460px;
      max-width: 90%;
    `;
    
    const title = document.createElement('h2');
    title.textContent = 'Complete Your Setup';
    title.style.cssText = `
      margin: 0 0 12px 0;
      color: #333;
      text-align: center;
      font-size: 24px;
    `;
    
    const description = document.createElement('p');
    description.textContent = 'Please set your email and choose a new password.';
    description.style.cssText = `
      margin: 0 0 24px 0;
      color: #555;
      text-align: center;
      font-size: 14px;
    `;
    
    const form = document.createElement('form');
    form.id = 'setup-form';
    form.method = 'POST';
    form.action = 'javascript:void(0);';
    
    // Email field
    const emailGroup = this.createFormGroup('Email', 'email', 'email', 'your.email@example.com');
    
    // New password field
    const passwordGroup = this.createFormGroup('New Password', 'new-password', 'password', '');
    
    // Confirm password field
    const confirmGroup = this.createFormGroup('Confirm Password', 'confirm-password', 'password', '');
    
    // Password requirements hint
    const requirements = document.createElement('div');
    requirements.style.cssText = `
      margin: 12px 0 20px 0;
      padding: 12px;
      background: #f8f9fa;
      border-left: 3px solid #667eea;
      font-size: 13px;
      color: #555;
      line-height: 1.6;
    `;
    requirements.innerHTML = `
      <strong>Password Requirements:</strong>
      <ul style="margin: 6px 0 0 20px; padding: 0;">
        <li>Minimum 6 characters</li>
        <li>At least 1 uppercase letter</li>
        <li>At least 1 lowercase letter</li>
        <li>At least 1 number</li>
      </ul>
    `;
    
    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.id = 'setup-submit-btn';
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Complete Setup';
    submitBtn.style.cssText = `
      width: 100%;
      padding: 14px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.2s;
    `;
    submitBtn.onmouseover = () => {
      if (!submitBtn.disabled) {
        submitBtn.style.background = '#5568d3';
      }
    };
    submitBtn.onmouseout = () => {
      if (!submitBtn.disabled) {
        submitBtn.style.background = '#667eea';
      }
    };
    
    // Error message
    const errorDiv = document.createElement('div');
    errorDiv.id = 'setup-error';
    errorDiv.style.cssText = `
      color: #dc3545;
      font-size: 14px;
      margin-top: 12px;
      text-align: center;
      display: none;
    `;
    
    // Assemble form
    form.appendChild(emailGroup);
    form.appendChild(passwordGroup);
    form.appendChild(confirmGroup);
    form.appendChild(requirements);
    form.appendChild(submitBtn);
    form.appendChild(errorDiv);
    
    formContainer.appendChild(title);
    formContainer.appendChild(description);
    formContainer.appendChild(form);
    overlay.appendChild(formContainer);
    
    // Handle form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
    
    return overlay;
  }
  
  /**
   * Create a form group (label + input)
   */
  private createFormGroup(label: string, id: string, type: string, placeholder: string): HTMLElement {
    const group = document.createElement('div');
    group.style.cssText = 'margin-bottom: 20px;';
    
    const labelEl = document.createElement('label');
    labelEl.htmlFor = id;
    labelEl.textContent = label;
    labelEl.style.cssText = `
      display: block;
      margin-bottom: 6px;
      color: #555;
      font-size: 14px;
      font-weight: bold;
    `;
    
    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    input.name = id;
    input.required = true;
    input.placeholder = placeholder;
    if (type === 'password') {
      input.autocomplete = 'new-password';
    } else if (type === 'email') {
      input.autocomplete = 'email';
    }
    input.style.cssText = `
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      box-sizing: border-box;
      transition: border-color 0.2s;
    `;
    input.onfocus = () => {
      input.style.borderColor = '#667eea';
    };
    input.onblur = () => {
      input.style.borderColor = '#ddd';
    };
    
    group.appendChild(labelEl);
    group.appendChild(input);
    return group;
  }
  
  /**
   * Validate and submit the form
   */
  private async handleSubmit(): Promise<void> {
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const newPasswordInput = document.getElementById('new-password') as HTMLInputElement;
    const confirmPasswordInput = document.getElementById('confirm-password') as HTMLInputElement;
    const errorDiv = document.getElementById('setup-error') as HTMLElement;
    const submitBtn = document.getElementById('setup-submit-btn') as HTMLButtonElement;
    
    const email = emailInput.value.trim();
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    // Clear previous errors
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    
    // Client-side validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showError('Please enter a valid email address');
      return;
    }
    
    if (newPassword.length < 6) {
      this.showError('Password must be at least 6 characters');
      return;
    }
    
    if (!/[A-Z]/.test(newPassword)) {
      this.showError('Password must contain at least one uppercase letter');
      return;
    }
    
    if (!/[a-z]/.test(newPassword)) {
      this.showError('Password must contain at least one lowercase letter');
      return;
    }
    
    if (!/[0-9]/.test(newPassword)) {
      this.showError('Password must contain at least one number');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      this.showError('Passwords do not match');
      return;
    }
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.style.background = '#ccc';
    submitBtn.style.cursor = 'not-allowed';
    submitBtn.textContent = 'Setting up...';
    
    try {
      // Submit to backend
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          newPassword
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Setup failed');
      }
      
      console.log('[SETUP] Setup completed successfully');
      
      // Hide form and trigger success callback
      this.hide();
      this.onSuccess();
      
    } catch (error: any) {
      console.error('[SETUP] Setup error:', error);
      this.showError(error.message || 'Setup failed. Please try again.');
      
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.style.background = '#667eea';
      submitBtn.style.cursor = 'pointer';
      submitBtn.textContent = 'Complete Setup';
    }
  }
  
  /**
   * Show error message
   */
  private showError(message: string): void {
    const errorDiv = document.getElementById('setup-error') as HTMLElement;
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
}
