const memoArea = document.getElementById('memo-area');
const previewArea = document.getElementById('preview-area');
const clearButton = document.getElementById('clear-button');
const toggleButton = document.getElementById('toggle-button');
const tabContainer = document.getElementById('tab-container');
const addTabButton = document.getElementById('add-tab-button');
const memo0Tab = document.getElementById('memo0-tab');

if (memo0Tab) {
  memo0Tab.textContent = "list";
}

let timeoutId = null;
let isPreviewMode = false;
let currentTabIndex = 1; 
let allMemos = [""]; 
let tabNames = ["list"]; 

const allowedDomains = ["google.com", "youtube.com", "github.com", "yahoo.co.jp", "twitter.com", "x.com"];
const urlRegex = /(https?:\/\/[^\s<]+)/gi;

// 1. 保存データの読み込み
chrome.storage.local.get(['allMemos', 'tabNames', 'lastActiveIndex'], (result) => {
  if (result.allMemos && result.allMemos.length > 0) {
    allMemos = result.allMemos;
  } else {
    allMemos = ["", ""];
  }

  if (result.tabNames && result.tabNames.length === allMemos.length) {
    tabNames = result.tabNames;
  } else {
    tabNames = ["list"];
    for (let i = 1; i < allMemos.length; i++) {
      tabNames.push(`M${i}`);
    }
  }
  
  if (result.lastActiveIndex !== undefined && result.lastActiveIndex < allMemos.length) {
    currentTabIndex = result.lastActiveIndex;
  } else {
    currentTabIndex = 1; 
  }
  
  generateMemo0();
  renderTabs();
  updateMemoUI();
});

// 2. メモの結合 (listタブ用)
function generateMemo0() {
  let combinedText = "";
  for (let i = 1; i < allMemos.length; i++) {
    const content = allMemos[i] ? allMemos[i] : "";
    const tName = tabNames[i] || `M${i}`; 
    combinedText += `[${tName}]\n${content}\n\n`; 
  }
  allMemos[0] = combinedText.trim();
}

// 3. テキスト分解
function parseMemo0ToTabs(memo0Text) {
  const regex = /\[([^\]]+)\]/g; 
  const newMemos = [""];
  const newTabNames = ["list"];

  let matches = [];
  let match;
  while ((match = regex.exec(memo0Text)) !== null) {
    matches.push({
      name: match[1],
      index: match.index,
      contentStart: match.index + match[0].length
    });
  }

  if (matches.length === 0) {
    for (let i = 1; i < allMemos.length; i++) {
      allMemos[i] = "";
    }
    renderTabs();
    return;
  }

  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const end = (i + 1 < matches.length) ? matches[i + 1].index : memo0Text.length;
    let textBlock = memo0Text.substring(currentMatch.contentStart, end).trim();

    newTabNames.push(currentMatch.name);
    newMemos.push(textBlock);
  }

  allMemos = newMemos;
  tabNames = newTabNames;

  if (currentTabIndex >= allMemos.length) {
    currentTabIndex = allMemos.length - 1;
  }

  renderTabs();
}

function convertAllToLink(text) {
  if (!text) return '';
  
  let safeText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = safeText.split('\n');
  
  const processedLines = lines.map(line => {
    const hasAllowedDomain = allowedDomains.some(domain => line.toLowerCase().includes(domain));
    if (!hasAllowedDomain) return line;

    return line.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" contenteditable="false">${url}</a>`;
    });
  });

  return processedLines.join('<br>');
}

// 5. 保存
function saveMemos() {
  chrome.storage.local.set({ 
    allMemos: allMemos,
    tabNames: tabNames, 
    lastActiveIndex: currentTabIndex
  });
}

// 6. 入力処理
function handleInput(text) {
  if (currentTabIndex === 0) {
    allMemos[0] = text;
    parseMemo0ToTabs(text);
  } else {
    allMemos[currentTabIndex] = text;
    generateMemo0();
  }
  
  clearTimeout(timeoutId);
  timeoutId = setTimeout(saveMemos, 300);
}

memoArea.addEventListener('input', () => handleInput(memoArea.value));
previewArea.addEventListener('input', () => handleInput(previewArea.innerText));

previewArea.addEventListener('click', (e) => {
  if (e.target.tagName !== 'A') {
    previewArea.focus();
  }
});

// 7. タブ描画
function renderTabs() {
  if (!tabContainer || !memo0Tab) return;
  
  memo0Tab.classList.toggle('active', currentTabIndex === 0);
  
  const fragment = document.createDocumentFragment();
  
  for (let idx = 1; idx < allMemos.length; idx++) {
    const tab = document.createElement('div');
    tab.className = `tab-button ${idx === currentTabIndex ? 'active' : ''}`;
    tab.setAttribute('draggable', 'true');
    tab.dataset.index = idx; 
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = tabNames[idx] || `M${idx}`;
    tab.appendChild(nameSpan);
    
    tab.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (isPreviewMode) return;

      const currentName = tabNames[idx];
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentName;
      input.style.width = '60px';
      input.style.fontSize = '11px';
      input.style.border = 'none';
      input.style.background = '#202124';
      input.style.color = '#ffffff';
      input.style.borderRadius = '2px';
      input.style.padding = '2px';

      tab.replaceChild(input, nameSpan);
      input.focus();
      input.select();

      const finishEdit = () => {
        let newName = input.value.trim();
        if (!newName || newName.includes('[') || newName.includes(']')) {
          newName = currentName;
        }
        tabNames[idx] = newName;
        nameSpan.textContent = newName;
        tab.replaceChild(nameSpan, input);
        
        generateMemo0(); 
        saveMemos();
      };

      input.addEventListener('blur', finishEdit);
      input.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter') {
          evt.preventDefault();
          input.blur(); 
        }
        if (evt.key === 'Escape') {
          evt.preventDefault();
          input.value = currentName; 
          input.blur();
        }
      });
    });
    
    tab.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.className === 'close-tab') return; 
      switchTab(idx);//idx=index
    });

    tab.addEventListener('dragstart', (e) => {
      tab.classList.add('dragging');
      e.dataTransfer.setData('text/plain', idx);
    });

    tab.addEventListener('dragend', () => {
      tab.classList.remove('dragging');
      document.querySelectorAll('.tab-button').forEach(t => t.classList.remove('drag-over'));
    });

    tab.addEventListener('dragover', (e) => {
      e.preventDefault(); 
      tab.classList.add('drag-over');
    });

    tab.addEventListener('dragleave', () => {
      tab.classList.remove('drag-over');
    });

    tab.addEventListener('drop', (e) => {
      e.preventDefault();
      tab.classList.remove('drag-over');
      
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIndex = parseInt(tab.dataset.index, 10);
      
      if (fromIndex !== toIndex) {
        const targetMemo = allMemos.splice(fromIndex, 1)[0];
        const targetName = tabNames.splice(fromIndex, 1)[0];
        
        allMemos.splice(toIndex, 0, targetMemo);
        tabNames.splice(toIndex, 0, targetName);
        
        if (currentTabIndex === fromIndex) {
          currentTabIndex = toIndex;
        } else if (currentTabIndex > fromIndex && currentTabIndex <= toIndex) {
          currentTabIndex--;
        } else if (currentTabIndex < fromIndex && currentTabIndex >= toIndex) {
          currentTabIndex++;
        }
        
        generateMemo0();
        renderTabs();
        saveMemos();
      }
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-tab';
    closeBtn.textContent = '×';
    closeBtn.title = 'メモを削除';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation(); 
      removeTab(idx);
    });

    tab.appendChild(closeBtn);
    fragment.appendChild(tab);
  }
  
  tabContainer.innerHTML = '';
  tabContainer.appendChild(fragment);
}

memo0Tab.addEventListener('click', () => {
  switchTab(0);
});

function switchTab(index) {
  if (isPreviewMode) toggleMode();
  currentTabIndex = index;
  
  if (currentTabIndex === 0) {
    generateMemo0();
  }

  renderTabs();
  updateMemoUI();
  memoArea.focus();
}

function updateMemoUI() {
  memoArea.value = allMemos[currentTabIndex] || "";
  previewArea.innerHTML = convertAllToLink(allMemos[currentTabIndex] || "");
  
  memoArea.disabled = false;
  previewArea.setAttribute('contenteditable', 'true');
  toggleButton.style.display = 'inline-block';
  clearButton.style.display = 'inline-block';
  
  saveMemos();
}

function addNewTab() {
  if (isPreviewMode) toggleMode();
  allMemos.push(""); 
  tabNames.push(`M${allMemos.length - 1}`);
  
  currentTabIndex = allMemos.length - 1; 
  generateMemo0(); 
  renderTabs();
  updateMemoUI();
  
  const tabBar = document.querySelector('.tab-bar');
  if (tabBar) {
    tabBar.scrollLeft = tabBar.scrollWidth;
  }
  memoArea.focus();
}

if (addTabButton) {
  addTabButton.addEventListener('click', addNewTab);
}

function removeTab(index) {
  if (isPreviewMode) toggleMode();
  
  if (allMemos.length <= 2) {
    allMemos[1] = "";
    tabNames[1] = "M1"; 
    generateMemo0();
    updateMemoUI();
    renderTabs();
    return;
  }

  allMemos.splice(index, 1);
  tabNames.splice(index, 1); 

  if (currentTabIndex >= allMemos.length) {
    currentTabIndex = allMemos.length - 1;
  } else if (currentTabIndex === index && currentTabIndex > 0) {
    currentTabIndex--;
  }

  renderTabs();
  updateMemoUI();
  generateMemo0(); 
  memoArea.focus();
}

function toggleMode() {
  if (!isPreviewMode) {
    previewArea.innerHTML = convertAllToLink(memoArea.value);
    memoArea.style.display = 'none';
    previewArea.style.display = 'block';
    toggleButton.textContent = 'Edit'; 
    isPreviewMode = true;
    previewArea.focus();
  } else {
    memoArea.value = previewArea.innerText;
    allMemos[currentTabIndex] = memoArea.value;
    
    if (currentTabIndex === 0) {
      parseMemo0ToTabs(memoArea.value);
    } else {
      generateMemo0();
    }
    
    memoArea.style.display = 'block';
    previewArea.style.display = 'none';
    toggleButton.textContent = 'URL';
    isPreviewMode = false;
    memoArea.focus();
  }
}

if (toggleButton) {
  toggleButton.addEventListener('click', toggleMode);
}

function clearMemo() {
  allMemos[currentTabIndex] = "";
  if (currentTabIndex === 0) {
    for (let i = 1; i < allMemos.length; i++) {
      allMemos[i] = "";
    }
  } else {
    generateMemo0();
  }
  memoArea.value = "";
  previewArea.innerHTML = "";
  saveMemos();
  memoArea.focus();
}

if (clearButton) {
  clearButton.addEventListener('click', clearMemo);
}

// 8. キーボードショートカット
window.addEventListener('keydown', (event) => {
  const isEditingText = (document.activeElement === memoArea || document.activeElement === previewArea);

  if (event.key === 'Escape') {
    event.preventDefault();
    memoArea.blur();    
    previewArea.blur(); 
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    toggleMode();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key === 'Backspace') {
    event.preventDefault();
    clearMemo(); 
    return;
  }

  // テキスト入力中でない場合のみショートカットを有効化する修正
  if (!isEditingText) {
    if (event.shiftKey && (event.key === 'T' || event.key === 't')) {
      event.preventDefault();
      addNewTab();
      return;
    }

    if (event.shiftKey && (event.key === 'W' || event.key === 'w')) {
      event.preventDefault();
      removeTab(currentTabIndex);
      return;
    }

    const matchDigit = event.code.match(/^Digit([0-9])$/);
    if (event.shiftKey && matchDigit) {
      event.preventDefault();
      const digit = parseInt(matchDigit[1]);
      if (digit === 0) {
        switchTab(0);
      } else if (digit < allMemos.length) {
        switchTab(digit);
      }
    }
  }
});