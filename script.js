const lengthSlider = document.getElementById('lengthSlider');
const lengthValue = document.getElementById('lengthValue');
const uppercaseCb = document.getElementById('uppercase');
const lowercaseCb = document.getElementById('lowercase');
const numbersCb = document.getElementById('numbers');
const symbolsCb = document.getElementById('symbols');
const generateBtn = document.getElementById('generateBtn');
const passwordDisplay = document.getElementById('passwordDisplay');
const copyBtn = document.getElementById('copyBtn');
const strengthBar = document.getElementById('strengthBar');
const strengthText = document.getElementById('strengthText');

// Character sets
const charSets = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+~`|}{[]:;?><,./-='
};

// Colors for strength
const strengthColors = ['#ef4444', '#f59e0b', '#10b981', '#8b5cf6'];
const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];

// Initialize slider
lengthSlider.addEventListener('input', (e) => {
    lengthValue.textContent = e.target.value;
});

// Calculate strength based on length and variety
function calculateStrength(length, typesCount) {
    let strength = 0;
    
    if (length >= 8) strength += 1;
    if (length >= 12) strength += 1;
    if (length >= 16) strength += 1;
    
    if (typesCount >= 3) strength += 1;
    if (typesCount === 4) strength += 1;
    
    if (length < 8 && typesCount < 3) strength = 1;
    
    // Normalize to 1-4
    strength = Math.min(Math.max(1, Math.floor(strength * 0.8)), 4);
    
    return strength;
}

// Update UI for strength
function updateStrengthMeter(strength) {
    const percentage = strength * 25;
    strengthBar.style.width = `${percentage}%`;
    strengthBar.style.backgroundColor = strengthColors[strength - 1];
    
    strengthText.textContent = strengthLabels[strength - 1];
    strengthText.style.color = strengthColors[strength - 1];
    
    // Add glow effect based on strength
    strengthBar.style.boxShadow = `0 0 10px ${strengthColors[strength - 1]}`;
}

// Generate Password
function generatePassword() {
    const length = +lengthSlider.value;
    const hasUpper = uppercaseCb.checked;
    const hasLower = lowercaseCb.checked;
    const hasNumber = numbersCb.checked;
    const hasSymbol = symbolsCb.checked;
    
    let typesCount = hasUpper + hasLower + hasNumber + hasSymbol;
    
    if (typesCount === 0) {
        // If nothing is checked, default to lowercase
        lowercaseCb.checked = true;
        typesCount = 1;
    }
    
    let charset = '';
    if (hasUpper) charset += charSets.uppercase;
    if (hasLower) charset += charSets.lowercase;
    if (hasNumber) charset += charSets.numbers;
    if (hasSymbol) charset += charSets.symbols;
    
    let password = '';
    
    // Ensure at least one character from each selected type is included
    if (hasUpper) password += charSets.uppercase[Math.floor(Math.random() * charSets.uppercase.length)];
    if (hasLower) password += charSets.lowercase[Math.floor(Math.random() * charSets.lowercase.length)];
    if (hasNumber) password += charSets.numbers[Math.floor(Math.random() * charSets.numbers.length)];
    if (hasSymbol) password += charSets.symbols[Math.floor(Math.random() * charSets.symbols.length)];
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
        password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    password = password.split('').sort(() => 0.5 - Math.random()).join('');
    
    // Display password
    passwordDisplay.innerHTML = password;
    passwordDisplay.style.color = 'var(--text-primary)';
    
    // Reset copy button
    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
    copyBtn.classList.remove('copied');
    copyBtn.title = "Copy to clipboard";
    
    // Update strength
    const strength = calculateStrength(length, typesCount);
    updateStrengthMeter(strength);
}

// Copy to clipboard
copyBtn.addEventListener('click', () => {
    const password = passwordDisplay.innerText;
    
    if (!password || passwordDisplay.querySelector('.placeholder')) return;
    
    navigator.clipboard.writeText(password).then(() => {
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        copyBtn.classList.add('copied');
        copyBtn.title = "Copied!";
        
        setTimeout(() => {
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
            copyBtn.classList.remove('copied');
            copyBtn.title = "Copy to clipboard";
        }, 2000);
    });
});

// Event listener for generate button
generateBtn.addEventListener('click', () => {
    // Add brief animation to button
    generateBtn.style.transform = 'scale(0.98)';
    setTimeout(() => {
        generateBtn.style.transform = '';
    }, 100);
    
    generatePassword();
});

// Initialize with a default password on load
generatePassword();
