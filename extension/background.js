import { dispatchSave, dispatchAddTag, dispatchAddNewTag } from './lib/dispatch.js'
import { isAutoSaveEnabled } from './lib/auto-save-config.js'
import { removeUrl as mirrorRemoveUrl } from './lib/saved-urls-mirror.js'
import { normalizeUrl } from './lib/normalize-url.js'

async function safeDispatch(args, tabId) {
  try {
    await dispatchSave(args)
  } catch (e) {
    console.warn('[booklage] save failed:', e)
    chrome.tabs.sendMessage(tabId, { type: 'booklage:cursor-pill', state: 'error' }).catch(() => {})
  }
}

// Trigger 1: keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'save-current-page') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  await safeDispatch({ trigger: 'shortcut', tabId: tab.id }, tab.id)
})

// Trigger 2: context menu — page + link (registered on install)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'booklage-save-page',
    title: 'Save to AllMarks',
    contexts: ['page'],
  })
  chrome.contextMenus.create({
    id: 'booklage-save-link',
    title: 'Save link to AllMarks',
    contexts: ['link'],
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return
  if (info.menuItemId === 'booklage-save-page') {
    await safeDispatch({ trigger: 'context-page', tabId: tab.id }, tab.id)
  } else if (info.menuItemId === 'booklage-save-link' && info.linkUrl) {
    await safeDispatch({ trigger: 'context-link', tabId: tab.id, linkUrl: info.linkUrl }, tab.id)
  }
})

// Trigger 3: bookmarklet hand-off (forwarded from content script)
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg) return
  if (msg.type === 'booklage:dispatch-bookmarklet') {
    const tabId = sender.tab?.id
    if (!tabId) return
    void safeDispatch(
      { trigger: 'bookmarklet', tabId, ogpFromBookmarklet: msg.ogp || null },
      tabId,
    )
    return
  }
  if (msg.type === 'booklage:auto-save') {
    const tabId = sender.tab?.id
    if (!tabId) return
    void (async () => {
      const enabled = await isAutoSaveEnabled(msg.source, chrome.storage.sync)
      if (!enabled) return
      await safeDispatch(
        { trigger: 'auto-' + msg.source, tabId, ogpFromBookmarklet: msg.ogp || null },
        tabId,
      )
    })()
    return
  }
  if (msg.type === 'booklage:floating-button-save') {
    const tabId = sender.tab?.id
    if (!tabId) return
    void safeDispatch({ trigger: 'floating-button', tabId }, tabId)
    return
  }
  if (msg.type === 'booklage:add-tag-request') {
    if (typeof msg.bookmarkId !== 'string' || typeof msg.tagId !== 'string') return
    void dispatchAddTag({ bookmarkId: msg.bookmarkId, tagId: msg.tagId }).catch((e) => {
      console.warn('[booklage] add-tag failed:', e)
    })
    return
  }
  if (msg.type === 'booklage:add-new-tag-request') {
    if (typeof msg.bookmarkId !== 'string' || typeof msg.name !== 'string' || !msg.name.trim()) return
    void dispatchAddNewTag({ bookmarkId: msg.bookmarkId, name: msg.name }).catch((e) => {
      console.warn('[booklage] add-new-tag failed:', e)
    })
    return
  }
  if (msg.type === 'booklage:url-deleted') {
    if (typeof msg.url !== 'string' || !msg.url) return
    // AllMarks sends the raw URL it had in IDB; mirror keys are normalized,
    // so we normalize the incoming URL too before remove.
    void mirrorRemoveUrl(normalizeUrl(msg.url), chrome.storage.local).catch(() => {})
    return
  }
  // The AllMarks board (booklage tab) asks to open the extension's options
  // page via the SETTINGS chrome entry. Forwarded here by the content script.
  if (msg.type === 'booklage:open-options') {
    void chrome.runtime.openOptionsPage()
    return
  }
})
