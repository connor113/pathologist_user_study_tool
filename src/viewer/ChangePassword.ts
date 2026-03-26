/**
 * ChangePassword.ts - Change password modal for logged-in users
 */

export class ChangePassword {
  private container: HTMLElement;
  private onSuccess: () => void;
  
  constructor(onSuccess: () => void) {
    this.onSuccess = onSuccess;
    this.container = this.createChangePasswordForm();
  }
  
  /**
   * Show the change password form
   */
  public show(): void {
    document.body.appendChild(this.container);
  }
  
  /**
   * Hide and remove the change password form
   */
  public hide(): void {
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
  
  /**
   * Create the change password form DOM
   */
  private createChangePasswordForm(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'change-password-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.hide();
      }
    });
    
    const formContainer = document.createElement('div');
    formContainer.style.cssText = `
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      width: 460px;
      max-width: 90%;
    `;
    
    // Prevent clicks inside form from closing overlay
    formContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    const title = document.createElement('h2');
    title.textContent = 'Change Password';
    title.style.cssText = `
      margin: 0 0 12px 0;
      color: #333;
      text-align: center;
      font-size: 24px;
    `;
    
    const description = document.createElement('p');
    description.textContent = 'Enter your current password and choose a new one.';
    description.style.cssText = `
      margin: 0 0 24px 0;
      color: #555;
      text-align: center;
      font-size: 14px;
    `;
    
    const form = document.createElement('form');
    form.id = 'change-password-form';
    form.method = 'POST';
    form.action = 'javascript:void(0);';
    
    // Current password field
    const currentPasswordGroup = this.createFormGroup('Current Password', 'current-password', 'password', '');
    
    // New password field
    const newPasswordGroup = this.createFormGroup('New Password', 'new-password-change', 'password', '');
    
    // Confirm password field
    const confirmPasswordGroup = this.createFormGroup('Confirm New Password', 'confirm-password-change', 'password', '');
    
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
    
    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      gap: 12px;
      margin-top: 20px;
    `;
    
    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'change-password-cancel-btn';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      flex: 1;
      padding: 14px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.2s;
    `;
    cancelBtn.onmouseover = () => {
      cancelBtn.style.background = '#5a6268';
    };
    cancelBtn.onmouseout = () => {
      cancelBtn.style.background = '#6c757d';
    };
    cancelBtn.addEventListener('click', () => {
      this.hide();
    });
    
    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.id = 'change-password-submit-btn';
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Change Password';
    submitBtn.style.cssText = `
      flex: 1;
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
    
    buttonsContainer.appendChild(cancelBtn);
    buttonsContainer.appendChild(submitBtn);
    
    // Error message
    const errorDiv = document.createElement('div');
    errorDiv.id = 'change-password-error';
    errorDiv.style.cssText = `
      color: #dc3545;
      font-size: 14px;
      margin-top: 12px;
      text-align: center;
      display: none;
    `;
    
    // Success message
    const successDiv = document.createElement('div');
    successDiv.id = 'change-password-success';
    successDiv.style.cssText = `
      color: #28a745;
      font-size: 14px;
      margin-top: 12px;
      text-align: center;
      display: none;
    `;
    
    // Assemble form
    form.appendChild(currentPasswordGroup);
    form.appendChild(newPasswordGroup);
    form.appendChild(confirmPasswordGroup);
    form.appendChild(requirements);
    form.appendChild(buttonsContainer);
    form.appendChild(errorDiv);
    form.appendChild(successDiv);
    
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
    const currentPasswordInput = document.getElementById('current-password') as HTMLInputElement;
    const newPasswordInput = document.getElementById('new-password-change') as HTMLInputElement;
    const confirmPasswordInput = document.getElementById('confirm-password-change') as HTMLInputElement;
    const errorDiv = document.getElementById('change-password-error') as HTMLElement;
    const successDiv = document.getElementById('change-password-success') as HTMLElement;
    const submitBtn = document.getElementById('change-password-submit-btn') as HTMLButtonElement;
    
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    // Clear previous messages
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    successDiv.style.display = 'none';
    successDiv.textContent = '';
    
    // Client-side validation
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
    submitBtn.textContent = 'Changing password...';
    
    try {
      // Submit to backend
      const { API_BASE_URL } = await import('./api');
      const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Password change failed');
      }
      
      console.log('[CHANGE_PASSWORD] Password changed successfully');
      
      // Show success message
      this.showSuccess('Password changed successfully!');
      
      // Clear form
      currentPasswordInput.value = '';
      newPasswordInput.value = '';
      confirmPasswordInput.value = '';
      
      // Close modal after 2 seconds
      setTimeout(() => {
        this.hide();
        this.onSuccess();
      }, 2000);
      
    } catch (error: any) {
      console.error('[CHANGE_PASSWORD] Error:', error);
      this.showError(error.message || 'Password change failed. Please try again.');
      
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.style.background = '#667eea';
      submitBtn.style.cursor = 'pointer';
      submitBtn.textContent = 'Change Password';
    }
  }
  
  /**
   * Show error message
   */
  private showError(message: string): void {
    const errorDiv = document.getElementById('change-password-error') as HTMLElement;
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
  
  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    const successDiv = document.getElementById('change-password-success') as HTMLElement;
    successDiv.textContent = message;
    successDiv.style.display = 'block';
  }
}
