export const WIDGET_STYLES = `
  .qwen-multiangle-container {
    width: 100%;
    height: 100%;
    position: relative;
    background: #0a0a0f;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border-radius: 8px;
    overflow: hidden;
  }

  .qwen-multiangle-canvas {
    width: 100%;
    height: 100%;
    display: block;
    position: relative;
  }

  .qwen-multiangle-prompt {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    background: rgba(10, 10, 15, 0.9);
    border: 1px solid rgba(233, 61, 130, 0.3);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 11px;
    color: #E93D82;
    backdrop-filter: blur(4px);
    font-family: 'Consolas', 'Monaco', monospace;
    word-break: break-all;
    line-height: 1.4;
  }

  .qwen-multiangle-info {
    position: absolute;
    bottom: 8px;
    left: 8px;
    right: 8px;
    background: rgba(10, 10, 15, 0.9);
    border: 1px solid rgba(233, 61, 130, 0.3);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 11px;
    color: #e0e0e0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    backdrop-filter: blur(4px);
  }

  .qwen-multiangle-info-row {
    display: flex;
    justify-content: space-around;
    align-items: center;
  }

  .qwen-multiangle-control {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .qwen-multiangle-param {
    text-align: center;
  }

  .qwen-multiangle-param-value {
    font-weight: 600;
    font-size: 13px;
  }

  .qwen-multiangle-param-value.azimuth {
    color: #E93D82;
  }

  .qwen-multiangle-param-value.elevation {
    color: #00FFD0;
  }

  .qwen-multiangle-param-value.zoom {
    color: #FFB800;
  }

  .qwen-multiangle-reset {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 1px solid rgba(233, 61, 130, 0.4);
    background: rgba(10, 10, 15, 0.8);
    color: #E93D82;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .qwen-multiangle-reset:hover {
    background: rgba(233, 61, 130, 0.2);
    border-color: #E93D82;
  }

  .qwen-multiangle-reset:active {
    transform: scale(0.95);
  }

  .qwen-multiangle-dropdown-label {
    font-size: 9px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .qwen-multiangle-dropdown-label.azimuth {
    color: #E93D82;
  }

  .qwen-multiangle-dropdown-label.elevation {
    color: #00FFD0;
  }

  .qwen-multiangle-dropdown-label.distance {
    color: #FFB800;
  }

  .qwen-multiangle-select {
    background: rgba(10, 10, 15, 0.9);
    border: 1px solid rgba(100, 100, 120, 0.4);
    border-radius: 4px;
    padding: 2px 4px;
    font-size: 9px;
    color: #e0e0e0;
    cursor: pointer;
    outline: none;
    min-width: 0;
    max-width: 90px;
    backdrop-filter: blur(4px);
  }

  .qwen-multiangle-select:hover {
    border-color: rgba(150, 150, 170, 0.6);
  }

  .qwen-multiangle-select:focus {
    border-color: #E93D82;
  }

  .qwen-multiangle-select.azimuth:focus {
    border-color: #E93D82;
  }

  .qwen-multiangle-select.elevation:focus {
    border-color: #00FFD0;
  }

  .qwen-multiangle-select.distance:focus {
    border-color: #FFB800;
  }

  .qwen-multiangle-select option {
    background: #1a1a2e;
    color: #e0e0e0;
  }
`

export function injectStyles(): void {
  if (document.getElementById('qwen-multiangle-styles')) {
    return
  }
  const style = document.createElement('style')
  style.id = 'qwen-multiangle-styles'
  style.textContent = WIDGET_STYLES
  document.head.appendChild(style)
}
