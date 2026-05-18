(function() {
    'use strict';
    
    console.log('[NS助手] settings 模块开始加载');

    const NSSettings = {
        id: 'settings',
        name: '设置面板',
        description: '提供统一的设置界面',

        settings: {
            items: [
                {
                    id: 'autojump',
                    label: '链接自动跳转',
                    type: 'switch',
                    default: false,
                    value: () => GM_getValue('ns_settings_autojump_enabled', false)
                }
            ],
            handleChange(id, value, utils) {
                if (id === 'autojump') {
                    GM_setValue('ns_settings_autojump_enabled', value);
                    if (value && /^\/jump/.test(location.pathname)) {
                        const jumpButton = document.querySelector('.btn');
                        if (jumpButton) {
                            jumpButton.click();
                        }
                    }
                }
            }
        },

        config: {
            storage: {}
        },

        settingsCache: new Map(),
        needsSave: false,

        components: {
            createSwitch(id, checked, onChange) {
                const switchLabel = document.createElement('label');
                switchLabel.className = 'ns-settings-switch';

                switchLabel.innerHTML = `
                    <input type="checkbox" ${checked ? 'checked' : ''}>
                    <span class="ns-settings-switch-slider"></span>
                `;
                
                const input = switchLabel.querySelector('input');
                input.addEventListener('change', () => onChange(input.checked));
                
                return switchLabel;
            },

            createSelect(id, options, value, onChange) {
                const select = document.createElement('select');
                select.className = 'ns-settings-select';
                
                options.forEach(option => {
                    const optElement = document.createElement('option');
                    optElement.value = option.value;
                    optElement.textContent = option.label;
                    optElement.selected = option.value === value;
                    select.appendChild(optElement);
                });
                
                select.addEventListener('change', () => onChange(select.value));
                return select;
            },

            createInput(id, value, onChange, type = 'text') {
                const input = document.createElement('input');
                input.className = 'ns-settings-input';
                input.type = type;
                input.value = value;
                
                input.addEventListener('change', () => onChange(input.value));
                return input;
            },

            createButton(id, label, onClick) {
                const button = document.createElement('button');
                button.className = 'ns-settings-button';
                button.textContent = label;
                button.addEventListener('click', onClick);
                return button;
            },

            createSettingItem(label, component) {
                const container = document.createElement('div');
                container.className = 'ns-settings-item';
                
                const labelElement = document.createElement('span');
                labelElement.className = 'ns-settings-item-label';
                labelElement.textContent = label;
                
                container.appendChild(labelElement);
                container.appendChild(component);
                
                return container;
            },

            createSaveBar() {
                const saveBar = document.createElement('div');
                saveBar.className = 'ns-settings-save-bar';
                
                const saveButton = document.createElement('button');
                saveButton.className = 'ns-settings-save-button';
                saveButton.textContent = '保存设置';
                saveButton.addEventListener('click', () => {
                    NSSettings.saveAllSettings();
                });
                
                saveBar.appendChild(saveButton);
                return saveBar;
            }
        },

        saveAllSettings() {
            console.log('[NS助手] 开始保存设置');
            this.settingsCache.forEach((value, key) => {
                console.log(`[NS助手] 保存设置: ${key} = ${value}`);
                GM_setValue(key, value);
            });
            
            this.settingsCache.clear();
            this.needsSave = false;
            
            const saveBar = document.querySelector('.ns-settings-save-bar');
            if (saveBar) {
                saveBar.classList.remove('ns-settings-save-bar-active');
            }
            
            location.reload();
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

            createSettingsPanel() {
                const existingPanel = document.querySelector('.ns-settings-panel');
                if (existingPanel) {
                    existingPanel.remove();
                }

                const panel = document.createElement('div');
                panel.className = 'ns-settings-panel';
                panel.style.opacity = '0';
                panel.style.position = 'fixed';
                panel.style.top = '50vh';
                panel.style.left = '50vw';
                panel.style.transform = 'translate(-50%, -50%)';
                panel.innerHTML = `
                    <div class="ns-settings-header">
                        <h2 class="ns-settings-header-title">NS助手设置</h2>
                        <div class="ns-settings-header-controls">
                            <span class="ns-settings-header-fullscreen"></span>
                            <span class="ns-settings-header-close">×</span>
                        </div>
                    </div>
                    <div class="ns-settings-content">
                        <div class="ns-settings-content-modules"></div>
                    </div>
                    <div class="ns-settings-resize-handle"></div>
                `;

                document.body.appendChild(panel);

                const viewportHeight = window.innerHeight;
                const maxHeight = Math.min(viewportHeight * 0.8, 800);
                panel.style.maxHeight = `${maxHeight}px`;

                requestAnimationFrame(() => {
                    panel.style.opacity = '1';
                });

                const closeBtn = panel.querySelector('.ns-settings-header-close');
                const fullscreenBtn = panel.querySelector('.ns-settings-header-fullscreen');

                closeBtn.onclick = () => {
                    panel.style.opacity = '0';
                    panel.style.transform = 'translate(-50%, -48%) scale(0.95)';
                    setTimeout(() => panel.remove(), 300);
                };

                fullscreenBtn.onclick = () => {
                    panel.classList.toggle('fullscreen');
                    if (panel.classList.contains('fullscreen')) {
                        panel._prevStyle = {
                            width: panel.style.width,
                            height: panel.style.height
                        };
                    } else {
                        if (panel._prevStyle) {
                            panel.style.width = panel._prevStyle.width;
                            panel.style.height = panel._prevStyle.height;
                        }
                    }
                };

                const header = panel.querySelector('.ns-settings-header');
                let isDragging = false;
                let currentX;
                let currentY;
                let initialX;
                let initialY;

                const dragStart = (e) => {
                    if (e.type === "touchstart") {
                        initialX = e.touches[0].clientX;
                        initialY = e.touches[0].clientY;
                    } else {
                        initialX = e.clientX;
                        initialY = e.clientY;
                    }
                    
                    if (e.target === header || (e.target.closest('.ns-settings-header') && !e.target.closest('.ns-settings-header-controls'))) {
                        isDragging = true;
                        panel.style.transition = 'none';
                    }
                };

                const dragEnd = () => {
                    isDragging = false;
                    panel.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                };

                const drag = (e) => {
                    if (isDragging) {
                        e.preventDefault();
                        
                        if (e.type === "touchmove") {
                            currentX = e.touches[0].clientX - initialX;
                            currentY = e.touches[0].clientY - initialY;
                        } else {
                            currentX = e.clientX - initialX;
                            currentY = e.clientY - initialY;
                        }

                        const panelRect = panel.getBoundingClientRect();
                        const margin = 20;
                        
                        const maxX = (window.innerWidth - panelRect.width) / 2 + margin;
                        const maxY = (window.innerHeight - panelRect.height) / 2 + margin;
                        
                        currentX = Math.max(-maxX, Math.min(currentX, maxX));
                        currentY = Math.max(-maxY, Math.min(currentY, maxY));

                        panel.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`;
                    }
                };

                const resizeHandle = panel.querySelector('.ns-settings-resize-handle');
                let isResizing = false;
                let startWidth, startHeight, startX, startY;

                const resizeStart = (e) => {
                    isResizing = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    startWidth = panel.offsetWidth;
                    startHeight = panel.offsetHeight;
                    panel.style.transition = 'none';
                    document.body.style.cursor = 'se-resize';
                    e.preventDefault();
                    e.stopPropagation();
                };

                const resize = (e) => {
                    if (!isResizing) return;
                    
                    const width = startWidth + (e.clientX - startX);
                    const height = startHeight + (e.clientY - startY);
                    
                    const minWidth = 300;
                    const minHeight = 200;
                    const maxWidth = window.innerWidth * 0.9;
                    const maxHeight = window.innerHeight * 0.8;
                    
                    panel.style.width = `${Math.min(Math.max(width, minWidth), maxWidth)}px`;
                    panel.style.height = `${Math.min(Math.max(height, minHeight), maxHeight)}px`;
                    
                    e.preventDefault();
                    e.stopPropagation();
                };

                const resizeEnd = () => {
                    isResizing = false;
                    panel.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                    document.body.style.cursor = '';
                };

                resizeHandle.addEventListener('mousedown', resizeStart);
                document.addEventListener('mousemove', resize);
                document.addEventListener('mouseup', resizeEnd);

                header.addEventListener("touchstart", dragStart, { passive: false });
                header.addEventListener("touchend", dragEnd);
                header.addEventListener("touchmove", drag, { passive: false });
                header.addEventListener("mousedown", dragStart);
                document.addEventListener("mouseup", dragEnd);
                document.addEventListener("mousemove", drag);

                const handleResize = () => {
                    const viewportHeight = window.innerHeight;
                    const maxHeight = Math.min(viewportHeight * 0.8, 800);
                    panel.style.maxHeight = `${maxHeight}px`;
                    
                    panel.style.transform = 'translate(-50%, -50%)';
                    currentX = 0;
                    currentY = 0;
                };

                window.addEventListener('resize', handleResize);

                const cleanup = () => {
                    window.removeEventListener('resize', handleResize);
                    header.removeEventListener("touchstart", dragStart);
                    header.removeEventListener("touchend", dragEnd);
                    header.removeEventListener("touchmove", drag);
                    header.removeEventListener("mousedown", dragStart);
                    document.removeEventListener("mouseup", dragEnd);
                    document.removeEventListener("mousemove", drag);
                };

                panel.addEventListener('remove', cleanup);

                const saveBar = NSSettings.components.createSaveBar();
                panel.appendChild(saveBar);

                return panel;
            },

            renderModuleSettings() {
                const modulesContainer = document.querySelector('.ns-settings-content-modules');
                if (!modulesContainer) return;

                modulesContainer.innerHTML = '';
                window.NS.modules.forEach((module) => {
                    const moduleCard = document.createElement('div');
                    moduleCard.className = 'ns-settings-module';
                    
                    const moduleHeader = document.createElement('div');
                    moduleHeader.className = 'ns-settings-module-header';
                    
                    const moduleTitle = document.createElement('h3');
                    moduleTitle.className = 'ns-settings-module-title';
                    moduleTitle.textContent = module.name;
                    
                    const moduleSwitch = NSSettings.components.createSwitch(
                        `module_${module.id}_enabled`,
                        module.enabled,
                        (checked) => {
                            NSSettings.settingsCache.set(`module_${module.id}_enabled`, checked);
                            NSSettings.needsSave = true;
                            document.querySelector('.ns-settings-save-bar').classList.add('ns-settings-save-bar-active');
                        }
                    );
                    
                    moduleHeader.appendChild(moduleTitle);
                    moduleHeader.appendChild(moduleSwitch);
                    
                    const moduleDesc = document.createElement('p');
                    moduleDesc.className = 'ns-settings-module-desc';
                    moduleDesc.textContent = module.description;
                    
                    moduleCard.appendChild(moduleHeader);
                    moduleCard.appendChild(moduleDesc);
                    
                    if (module.settings && module.settings.items) {
                        const moduleSettings = document.createElement('div');
                        moduleSettings.className = 'ns-settings-module-content';
                        
                        module.settings.items.forEach(setting => {
                            let component;
                            const value = setting.value ? setting.value() : GM_getValue(`${module.id}_${setting.id}`, setting.default);
                            
                            switch (setting.type) {
                                case 'switch':
                                    component = NSSettings.components.createSwitch(
                                        `${module.id}_${setting.id}`,
                                        value,
                                        (checked) => {
                                            if (module.settings.handleChange) {
                                                module.settings.handleChange(setting.id, checked, {
                                                    cacheValue: (key, value) => {
                                                        NSSettings.settingsCache.set(key, value);
                                                        NSSettings.needsSave = true;
                                                        document.querySelector('.ns-settings-save-bar').classList.add('ns-settings-save-bar-active');
                                                    }
                                                });
                                            }
                                        }
                                    );
                                    break;
                                    
                                case 'select':
                                    component = NSSettings.components.createSelect(
                                        `${module.id}_${setting.id}`,
                                        setting.options,
                                        value,
                                        (newValue) => {
                                            if (module.settings.handleChange) {
                                                module.settings.handleChange(setting.id, newValue, {
                                                    cacheValue: (key, value) => {
                                                        NSSettings.settingsCache.set(key, value);
                                                        NSSettings.needsSave = true;
                                                        document.querySelector('.ns-settings-save-bar').classList.add('ns-settings-save-bar-active');
                                                    }
                                                });
                                            }
                                        }
                                    );
                                    break;
                                    
                                case 'text':
                                case 'number':
                                    component = NSSettings.components.createInput(
                                        `${module.id}_${setting.id}`,
                                        value,
                                        (newValue) => {
                                            if (module.settings.handleChange) {
                                                module.settings.handleChange(setting.id, newValue, {
                                                    cacheValue: (key, value) => {
                                                        NSSettings.settingsCache.set(key, value);
                                                        NSSettings.needsSave = true;
                                                        document.querySelector('.ns-settings-save-bar').classList.add('ns-settings-save-bar-active');
                                                    }
                                                });
                                            }
                                        },
                                        setting.type
                                    );
                                    break;

                                case 'button':
                                    component = NSSettings.components.createButton(
                                        `${module.id}_${setting.id}`,
                                        setting.label,
                                        setting.onClick
                                    );
                                    break;
                            }
                            
                            if (component) {
                                moduleSettings.appendChild(
                                    NSSettings.components.createSettingItem(setting.label, component)
                                );
                            }
                        });
                        
                        moduleCard.appendChild(moduleSettings);
                    }
                    
                    modulesContainer.appendChild(moduleCard);
                });
            }
        },

        init() {
            console.log('[NS助手] 初始化设置面板模块');
            
            // 初始化自动跳转功能
            if (GM_getValue('ns_settings_autojump_enabled', false)) {
                if (/^\/jump/.test(location.pathname)) {
                    const jumpButton = document.querySelector('.btn');
                    if (jumpButton) {
                        jumpButton.click();
                    }
                }
            }

            const styles = `
                .ns-settings-button {
                    min-width: 88px;
                    height: 36px;
                    padding: 4px 20px;
                    border: none;
                    border-radius: 6px;
                    background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
                    color: #fff;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    white-space: nowrap;
                }

                .ns-settings-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
                    background: linear-gradient(135deg, #40a9ff 0%, #1890ff 100%);
                }

                .ns-settings-button:active {
                    transform: translateY(1px);
                    background: linear-gradient(135deg, #096dd9 0%, #0050b3 100%);
                }

                .ns-settings-button::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle at center,
                        rgba(255, 255, 255, 0.2) 0%,
                        transparent 60%);
                    transform: scale(0);
                    transition: transform 0.6s;
                }

                .ns-settings-button:hover::before {
                    transform: scale(1);
                }

                .ns-settings-button:disabled {
                    background: #d9d9d9;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                .ns-settings-panel {
                    z-index: 99999;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
            `;
            
            GM_addStyle(styles);

            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://raw.githubusercontent.com/chunkburst/NSaide/main/modules/settings/style.css',
                onload: (response) => {
                    if (response.status === 200) {
                        console.log('[NS助手] 设置面板样式加载成功');
                        GM_addStyle(response.responseText);
                    } else {
                        console.error('[NS助手] 加载设置面板样式失败:', response.status);
                    }
                },
                onerror: (error) => {
                    console.error('[NS助手] 加载设置面板样式出错:', error);
                }
            });

            const boundCreateSettingsPanel = this.utils.createSettingsPanel.bind(this.utils);
            const boundRenderModuleSettings = this.utils.renderModuleSettings.bind(this.utils);

            GM_registerMenuCommand('⚙️ 打开设置面板', () => {
                const panel = boundCreateSettingsPanel();
                boundRenderModuleSettings();
            });

            console.log('[NS助手] 设置面板模块初始化完成');
        }
    };

    console.log('[NS助手] 等待模块系统就绪');
    let retryCount = 0;
    const maxRetries = 50;

    const waitForNS = () => {
        retryCount++;
        console.log(`[NS助手] 第 ${retryCount} 次尝试注册 settings 模块`);
        
        if (typeof window.NSRegisterModule === 'function') {
            console.log('[NS助手] 模块系统就绪，开始注册 settings');
            window.NSRegisterModule(NSSettings);
            console.log('[NS助手] settings 模块注册请求已发送');
        } else {
            console.log('[NS助手] 模块系统未就绪');
            if (retryCount < maxRetries) {
                setTimeout(waitForNS, 100);
            } else {
                console.error('[NS助手] 模块系统等待超时，settings 模块注册失败');
            }
        }
    };

    waitForNS();
    console.log('[NS助手] settings 模块加载完成 v0.0.5');
})(); 
