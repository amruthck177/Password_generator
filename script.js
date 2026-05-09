const elements = {
    lengthSlider: document.getElementById('lengthSlider'),
    lengthValue: document.getElementById('lengthValue'),
    uppercase: document.getElementById('uppercase'),
    lowercase: document.getElementById('lowercase'),
    numbers: document.getElementById('numbers'),
    symbols: document.getElementById('symbols'),
    excludeChars: document.getElementById('excludeChars'),
    generateBtn: document.getElementById('generateBtn'),
    passwordDisplay: document.getElementById('passwordDisplay'),
    shimmerEffect: document.getElementById('shimmerEffect'),
    copyBtn: document.getElementById('copyBtn'),
    copyTooltip: document.getElementById('copyTooltip'),
    lockIcon: document.getElementById('lockIcon'),
    magicModeToggle: document.getElementById('magicModeToggle'),
    entropyBadge: document.getElementById('entropyBadge'),
    strengthText: document.getElementById('strengthText'),
    segments: [
        document.getElementById('seg1'),
        document.getElementById('seg2'),
        document.getElementById('seg3'),
        document.getElementById('seg4'),
        document.getElementById('seg5')
    ],
    historyPanel: document.getElementById('historyPanel'),
    historyHeader: document.getElementById('historyHeader'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    historyList: document.getElementById('historyList'),
    rippleContainer: document.getElementById('rippleContainer')
};

const charSets = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    number: '0123456789',
    symbol: '!@#$%^&*()_+~`|}{[]:;?><,./-='
};

const strengthColors = ['var(--strength-1)', 'var(--strength-2)', 'var(--strength-3)', 'var(--strength-4)', 'var(--strength-5)'];
const strengthLabels = ['Easy', 'Simple', 'Moderate', 'Strong', 'Very Strong'];

let passwordHistory = [];

// Magic Mode Toggle
elements.magicModeToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        document.body.classList.add('magic-mode');
    } else {
        document.body.classList.remove('magic-mode');
    }
});

// Slider bounce animation
elements.lengthSlider.addEventListener('input', (e) => {
    elements.lengthValue.textContent = e.target.value;
    elements.lengthValue.classList.add('bounce');
    setTimeout(() => elements.lengthValue.classList.remove('bounce'), 150);
    calculateStrength(e.target.value);
});

// Button Ripple Effect
elements.generateBtn.addEventListener('click', function(e) {
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    
    elements.rippleContainer.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
    
    generatePasswordSequence();
});

// History Panel Toggle
elements.historyHeader.addEventListener('click', (e) => {
    if (e.target.closest('#clearHistoryBtn')) return;
    elements.historyPanel.classList.toggle('open');
});

// Clear History Button
elements.clearHistoryBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    passwordHistory = [];
    renderHistory();
});

// Calculate Entropy and Update UI
function calculateStrength(length) {
    const hasUpper = elements.uppercase.checked;
    const hasLower = elements.lowercase.checked;
    const hasNumber = elements.numbers.checked;
    const hasSymbol = elements.symbols.checked;
    
    let poolSize = 0;
    if (hasUpper) poolSize += 26;
    if (hasLower) poolSize += 26;
    if (hasNumber) poolSize += 10;
    if (hasSymbol) poolSize += charSets.symbol.length;
    
    if (poolSize === 0) poolSize = 26; // Default to lower if all unchecked
    
    const entropy = Math.floor(length * Math.log2(poolSize));
    elements.entropyBadge.textContent = `${entropy} bits`;
    
    let level = 0;
    if (entropy < 35) level = 1;
    else if (entropy < 55) level = 2;
    else if (entropy < 75) level = 3;
    else if (entropy < 100) level = 4;
    else level = 5;
    
    // Update segments
    elements.segments.forEach((seg, index) => {
        if (index < level) {
            seg.style.backgroundColor = strengthColors[level - 1];
            seg.style.boxShadow = `0 0 10px ${strengthColors[level - 1]}`;
        } else {
            seg.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            seg.style.boxShadow = 'none';
        }
    });
    
    // Update Label with animation
    elements.strengthText.style.opacity = '0';
    setTimeout(() => {
        elements.strengthText.textContent = strengthLabels[level - 1];
        elements.strengthText.style.color = strengthColors[level - 1];
        elements.strengthText.style.opacity = '1';
    }, 150);
    
    return { entropy, level, poolSize };
}

// Generate the actual password
function buildPassword() {
    const length = +elements.lengthSlider.value;
    const exclude = elements.excludeChars.value;
    
    let upper = charSets.upper;
    let lower = charSets.lower;
    let number = charSets.number;
    let symbol = charSets.symbol;
    
    if (exclude) {
        const regex = new RegExp(`[${exclude.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, 'g');
        upper = upper.replace(regex, '');
        lower = lower.replace(regex, '');
        number = number.replace(regex, '');
        symbol = symbol.replace(regex, '');
    }
    
    const types = [];
    if (elements.uppercase.checked && upper) types.push({ chars: upper, class: 'char-upper' });
    if (elements.lowercase.checked && lower) types.push({ chars: lower, class: 'char-lower' });
    if (elements.numbers.checked && number) types.push({ chars: number, class: 'char-number' });
    if (elements.symbols.checked && symbol) types.push({ chars: symbol, class: 'char-symbol' });
    
    if (types.length === 0) {
        // Fallback if user excludes everything or unchecks everything
        types.push({ chars: charSets.lower, class: 'char-lower' });
        elements.lowercase.checked = true;
    }
    
    let passwordChars = [];
    
    // Ensure at least one of each selected type
    types.forEach(type => {
        passwordChars.push({
            char: type.chars[Math.floor(Math.random() * type.chars.length)],
            class: type.class
        });
    });
    
    // Fill the rest
    const allChars = types.map(t => t.chars).join('');
    for (let i = passwordChars.length; i < length; i++) {
        const randomChar = allChars[Math.floor(Math.random() * allChars.length)];
        const type = types.find(t => t.chars.includes(randomChar)) || types[0];
        passwordChars.push({
            char: randomChar,
            class: type.class
        });
    }
    
    // Shuffle array
    for (let i = passwordChars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
    }
    
    return passwordChars;
}

function renderFormattedPassword(charsArray) {
    return charsArray.map(c => `<span class="${c.class}">${c.char === '<' ? '&lt;' : c.char === '>' ? '&gt;' : c.char}</span>`).join('');
}

function getRawPassword(charsArray) {
    return charsArray.map(c => c.char).join('');
}

// Main generation sequence handling Magic vs Normal
async function generatePasswordSequence() {
    // Spin Lock
    elements.lockIcon.classList.add('spin');
    setTimeout(() => elements.lockIcon.classList.remove('spin'), 500);
    
    const charsArray = buildPassword();
    const isMagic = document.body.classList.contains('magic-mode');
    const rawPassword = getRawPassword(charsArray);
    
    // Calculate Strength right away
    const { level } = calculateStrength(charsArray.length);
    
    elements.passwordDisplay.innerHTML = '';
    
    if (isMagic) {
        // Slot machine effect
        for (let shuffle = 0; shuffle < 3; shuffle++) {
            const dummy = buildPassword();
            elements.passwordDisplay.innerHTML = renderFormattedPassword(dummy);
            await new Promise(r => setTimeout(r, 100));
        }
        elements.passwordDisplay.innerHTML = renderFormattedPassword(charsArray);
    } else {
        // Typewriter effect
        for (let i = 0; i < charsArray.length; i++) {
            const c = charsArray[i];
            const span = document.createElement('span');
            span.className = c.class;
            span.textContent = c.char;
            elements.passwordDisplay.appendChild(span);
            await new Promise(r => setTimeout(r, 20));
        }
    }
    
    // Shimmer effect
    elements.shimmerEffect.classList.remove('active');
    void elements.shimmerEffect.offsetWidth; // trigger reflow
    elements.shimmerEffect.classList.add('active');
    
    // Reset Copy
    elements.copyBtn.classList.remove('copied');
    elements.copyBtn.dataset.password = rawPassword;
    
    addToHistory(rawPassword, charsArray, level);
}

// Add to History
function addToHistory(raw, charsArray, level) {
    // Prevent duplicates immediately
    if (passwordHistory.length > 0 && passwordHistory[0].raw === raw) return;
    
    passwordHistory.unshift({ raw, charsArray, level });
    if (passwordHistory.length > 5) passwordHistory.pop();
    
    renderHistory();
}

function renderHistory() {
    elements.historyList.innerHTML = '';
    passwordHistory.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.style.animationDelay = `${index * 0.1}s`;
        
        const pwdSpan = document.createElement('span');
        pwdSpan.className = 'history-pwd';
        pwdSpan.innerHTML = renderFormattedPassword(item.charsArray);
        
        const metaDiv = document.createElement('div');
        metaDiv.className = 'history-meta';
        
        const dot = document.createElement('div');
        dot.className = 'dot';
        dot.style.backgroundColor = strengthColors[item.level - 1];
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'mini-copy';
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
        copyBtn.onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(item.raw);
            copyBtn.innerHTML = '<i class="fa-solid fa-check text-green"></i>';
            setTimeout(() => copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>', 1500);
        };
        
        metaDiv.appendChild(dot);
        metaDiv.appendChild(copyBtn);
        
        li.appendChild(pwdSpan);
        li.appendChild(metaDiv);
        
        elements.historyList.appendChild(li);
    });
}

// Main Copy Button
elements.copyBtn.addEventListener('click', () => {
    const pwd = elements.copyBtn.dataset.password;
    if (!pwd) return;
    
    navigator.clipboard.writeText(pwd).then(() => {
        elements.copyBtn.classList.add('copied');
        elements.copyTooltip.classList.add('show');
        
        setTimeout(() => {
            elements.copyBtn.classList.remove('copied');
            elements.copyTooltip.classList.remove('show');
        }, 2000);
    });
});

// Initialize options listener to calculate strength live
['uppercase', 'lowercase', 'numbers', 'symbols'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => calculateStrength(+elements.lengthSlider.value));
});
elements.excludeChars.addEventListener('input', () => calculateStrength(+elements.lengthSlider.value));

// Run initial strength calc
calculateStrength(+elements.lengthSlider.value);
