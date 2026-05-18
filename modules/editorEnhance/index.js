(function() {
    'use strict';
    
    console.log('[NS助手] editorEnhance 模块开始加载');

    const NSEditorEnhance = {
        id: 'editorEnhance',
        name: '编辑器增强',
        description: '为编辑器添加快捷键等增强功能',

        config: {
            storage: {
                SHOW_TOAST: 'ns_editor_show_toast',
                SHOW_SHORTCUT_BTN: 'ns_editor_show_shortcut_btn'
            },
            shortcuts: {
                submit: {
                    windows: 'Ctrl-Enter',
                    mac: 'Cmd-Enter'
                },
                format: {
                    bold: {
                        windows: 'Ctrl-B',
                        mac: 'Cmd-B',
                        format: '**{text}**',
                        description: '粗体'
                    },
                    italic: {
                        windows: 'Ctrl-I',
                        mac: 'Cmd-I',
                        format: '*{text}*',
                        description: '斜体'
                    },
                    code: {
                        windows: 'Ctrl-K',
                        mac: 'Cmd-K',
                        format: '`{text}`',
                        description: '行内代码'
                    },
                    codeBlock: {
                        windows: 'Shift-Ctrl-K',
                        mac: 'Shift-Cmd-K',
                        format: '```\n{text}\n```',
                        description: '代码块'
                    },
                    codeBlockWithLang: {
                        windows: 'Alt-Ctrl-K',
                        mac: 'Alt-Cmd-K',
                        format: '```javascript\n{text}\n```',
                        description: 'JS代码块'
                    },
                    link: {
                        windows: 'Ctrl-L',
                        mac: 'Cmd-L',
                        format: '[{text}]()',
                        description: '链接'
                    },
                    image: {
                        windows: 'Shift-Ctrl-I',
                        mac: 'Shift-Cmd-I',
                        format: '![{text}]()',
                        description: '图片'
                    },
                    quote: {
                        windows: 'Ctrl-Q',
                        mac: 'Cmd-Q',
                        format: '> {text}',
                        description: '引用'
                    },
                    multiQuote: {
                        windows: 'Shift-Ctrl-Q',
                        mac: 'Shift-Cmd-Q',
                        format: '>> {text}',
                        description: '多级引用'
                    },
                    strikethrough: {
                        windows: 'Alt-S',
                        mac: 'Alt-S',
                        format: '~~{text}~~',
                        description: '删除线'
                    },
                    list: {
                        windows: 'Ctrl-U',
                        mac: 'Cmd-U',
                        format: '- {text}',
                        description: '无序列表'
                    },
                    orderedList: {
                        windows: 'Shift-Ctrl-O',
                        mac: 'Shift-Cmd-O',
                        format: '1. {text}',
                        description: '有序列表'
                    },
                    heading1: {
                        windows: 'Shift-Ctrl-1',
                        mac: 'Shift-Cmd-1',
                        format: '# {text}',
                        description: '一级标题'
                    },
                    heading2: {
                        windows: 'Shift-Ctrl-2',
                        mac: 'Shift-Cmd-2',
                        format: '## {text}',
                        description: '二级标题'
                    },
                    heading3: {
                        windows: 'Shift-Ctrl-3',
                        mac: 'Shift-Cmd-3',
                        format: '### {text}',
                        description: '三级标题'
                    },
                    heading4: {
                        windows: 'Shift-Ctrl-4',
                        mac: 'Shift-Cmd-4',
                        format: '#### {text}',
                        description: '四级标题'
                    },
                    table: {
                        windows: 'Shift-Ctrl-T',
                        mac: 'Shift-Cmd-T',
                        format: '| 表头 | 表头 |\n| --- | --- |\n| 内容 | 内容 |',
                        description: '表格'
                    }
                }
            }
        },

        settings: {
            items: [
                {
                    id: 'show_toast',
                    type: 'switch',
                    label: '显示加载提示',
                    default: true,
                    value: () => GM_getValue('ns_editor_show_toast', true)
                },
                {
                    id: 'show_shortcut_btn',
                    type: 'switch',
                    label: '显示编辑器快捷键按钮',
                    default: true,
                    value: () => GM_getValue('ns_editor_show_shortcut_btn', true)
                },
                {
                    id: 'view_shortcuts',
                    type: 'button',
                    label: '查看快捷键列表',
                    onClick: () => {
                        const modal = NSEditorEnhance.utils.createShortcutGuide();
                        document.body.appendChild(modal);
                    }
                }
            ],
            
            handleChange(settingId, value, settingsManager) {
                if (settingId === 'show_toast') {
                    settingsManager.cacheValue('ns_editor_show_toast', value);
                } else if (settingId === 'show_shortcut_btn') {
                    settingsManager.cacheValue('ns_editor_show_shortcut_btn', value);
                }
            }
        },

        utils: {
            async waitForElement(selector, parent = document, timeout = 10000) {
                const element = parent.querySelector(selector);
                if (element) return element;
            
                return new Promise((resolve) => {
                    const observer = new MutationObserver((mutations, obs) => {
                        const element = parent.querySelector(selector);
                        if (element) {
                            obs.disconnect();
                            resolve(element);
                        }
                    });
            
                    observer.observe(parent, {
                        childList: true,
                        subtree: true
                    });

                    setTimeout(() => {
                        observer.disconnect();
                        resolve(null);
                    }, timeout);
                });
            },

            isMac() {
                return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
            },

            showToast(message, type = 'info') {
                const toast = document.createElement('div');
                toast.className = `ns-editor-toast ns-editor-toast-${type}`;
                toast.textContent = message;
                document.body.appendChild(toast);
                
                toast.offsetHeight;
                
                requestAnimationFrame(() => {
                    toast.classList.add('ns-editor-toast-show');
                    
                    setTimeout(() => {
                        toast.classList.add('ns-editor-toast-fade-out');
                        setTimeout(() => toast.remove(), 300);
                    }, 3000);
                });
            },

            createShortcutGuide() {
                const isMac = this.isMac();
                const modal = document.createElement('div');
                modal.className = 'ns-editor-modal';
                
                const content = document.createElement('div');
                content.className = 'ns-editor-modal-content';
                
                const title = document.createElement('div');
                title.className = 'ns-editor-modal-title';
                title.textContent = 'Markdown快捷键';
                
                const closeBtn = document.createElement('div');
                closeBtn.className = 'ns-editor-modal-close';
                closeBtn.textContent = '×';
                closeBtn.onclick = () => modal.remove();
                
                const shortcuts = document.createElement('div');
                shortcuts.className = 'ns-editor-shortcuts-list';
                
                Object.entries(NSEditorEnhance.config.shortcuts.format).forEach(([key, config]) => {
                    const shortcut = document.createElement('div');
                    shortcut.className = 'ns-editor-shortcut-item';
                    shortcut.innerHTML = `
                        <span class="ns-editor-shortcut-desc">${config.description}</span>
                        <span class="ns-editor-shortcut-key">${isMac ? config.mac.replace('Cmd', '⌘').replace('Shift', '⇧').replace('Alt', '⌥').replace('-', ' + ') : config.windows.replace('-', ' + ')}</span>
                    `;
                    shortcuts.appendChild(shortcut);
                });

                content.appendChild(title);
                content.appendChild(closeBtn);
                content.appendChild(shortcuts);
                modal.appendChild(content);
                
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.remove();
                    }
                });
                
                return modal;
            }
        },

        async init() {
            console.log('[NS助手] 初始化编辑器增强模块');
            
            try {
                console.log('[NS助手] 开始加载编辑器增强样式');
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: 'https://raw.githubusercontent.com/chunkburst/NSaide/main/modules/editorEnhance/style.css',
                    onload: (response) => {
                        if (response.status === 200) {
                            console.log('[NS助手] 编辑器增强样式加载成功');
                            GM_addStyle(response.responseText);
                        } else {
                            console.error('[NS助手] 加载编辑器增强样式失败:', response.status);
                        }
                    },
                    onerror: (error) => {
                        console.error('[NS助手] 加载编辑器增强样式出错:', error);
                    }
                });

                const editorSetupResult = await this.setupEditor();
                if (editorSetupResult) {
                    console.log('[NS助手] 编辑器增强模块初始化完成');
                    if (GM_getValue('ns_editor_show_toast', true)) {
                        this.utils.showToast('编辑器增强已启用', 'success');
                    }
                } else {
                    console.log('[NS助手] 当前页面无编辑器，跳过增强');
                }
            } catch (error) {
                console.error('[NS助手] 编辑器增强模块初始化失败:', error);
            }
        },

        async setupEditor() {
            console.log('[NS助手] 等待编辑器加载...');
            
            const codeMirrorElement = await this.utils.waitForElement('.CodeMirror');
            if (!codeMirrorElement) {
                console.log('[NS助手] 未找到编辑器，跳过增强');
                return false;
            }

            const btnSubmit = await this.utils.waitForElement('.topic-select button.submit.btn.focus-visible');
            if (!btnSubmit) {
                console.log('[NS助手] 未找到提交按钮，跳过增强');
                return false;
            }

            const codeMirrorInstance = codeMirrorElement.CodeMirror;
            if (!codeMirrorInstance) {
                console.log('[NS助手] 未找到CodeMirror实例，跳过增强');
                return false;
            }

            const isMac = this.utils.isMac();
            const submitKey = isMac ? this.config.shortcuts.submit.mac : this.config.shortcuts.submit.windows;
            const submitText = isMac ? '⌘+Enter' : 'Ctrl+Enter';

            const topicSelect = btnSubmit.parentElement;
            if (GM_getValue('ns_editor_show_shortcut_btn', true)) {
                const shortcutBtn = document.createElement('button');
                shortcutBtn.className = 'ns-editor-shortcut-btn';
                shortcutBtn.textContent = 'MD快捷键';
                shortcutBtn.onclick = () => {
                    const modal = this.utils.createShortcutGuide();
                    document.body.appendChild(modal);
                };
                topicSelect.insertBefore(shortcutBtn, topicSelect.firstChild);
            }

            if (!btnSubmit.textContent.includes(submitText)) {
                btnSubmit.innerText = `发布评论 (${submitText})`;
            }

            const keyMap = {
                [submitKey]: (cm) => {
                    btnSubmit.click();
                }
            };

            Object.entries(this.config.shortcuts.format).forEach(([key, config]) => {
                const shortcutKey = isMac ? config.mac : config.windows;
                keyMap[shortcutKey] = (cm) => {
                    const selectedText = cm.getSelection() || '';
                    const cursor = cm.getCursor();
                    const formatted = config.format.replace('{text}', selectedText);
                    cm.replaceSelection(formatted);
                    
                    if (!selectedText) {
                        const cursorPos = cursor.ch + formatted.indexOf('{text}');
                        cm.setCursor({ line: cursor.line, ch: cursorPos });
                    }
                };
            });

            codeMirrorInstance.setOption('extraKeys', keyMap);
            return true;
        }
    };

    console.log('[NS助手] 等待模块系统就绪');
    let retryCount = 0;
    const maxRetries = 50;

    const waitForNS = () => {
        retryCount++;
        console.log(`[NS助手] 第 ${retryCount} 次尝试注册 editorEnhance 模块`);
        
        if (typeof window.NSRegisterModule === 'function') {
            console.log('[NS助手] 模块系统就绪，开始注册 editorEnhance');
            window.NSRegisterModule(NSEditorEnhance);
            console.log('[NS助手] editorEnhance 模块注册请求已发送');
        } else {
            console.log('[NS助手] 模块系统未就绪');
            if (retryCount < maxRetries) {
                setTimeout(waitForNS, 100);
            } else {
                console.error('[NS助手] 模块系统等待超时，editorEnhance 模块注册失败');
            }
        }
    };

    waitForNS();
    console.log('[NS助手] editorEnhance 模块加载完成');
})(); 
