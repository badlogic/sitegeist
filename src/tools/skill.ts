import { Diff, html, i18n, icon, type TemplateResult } from "@mariozechner/mini-lit";
import "@mariozechner/mini-lit/dist/MarkdownBlock.js";
import { type AgentTool, StringEnum, type ToolResultMessage } from "@mariozechner/pi-ai";
import {
	registerToolRenderer,
	renderCollapsibleHeader,
	renderHeader,
	SandboxIframe,
	type ToolRenderer,
	type ToolRenderResult,
} from "@mariozechner/pi-web-ui";
import { type Static, Type } from "@sinclair/typebox";
import { createRef, ref } from "lit/directives/ref.js";
import { Sparkles } from "lucide";
import { DomainPill } from "../components/DomainPill.js";
import { SkillPill } from "../components/SkillPill.js";
import { SKILL_TOOL_DESCRIPTION } from "../prompts/prompts.js";
import { getSitegeistStorage } from "../storage/app-storage.js";
import type { Skill } from "../storage/stores/skills-store.js";

// Cross-browser API
// @ts-expect-error
const browser = globalThis.browser || globalThis.chrome;

const getSkills = () => getSitegeistStorage().skills;

// Default skills shipped with the extension
const defaultSkills: Skill[] = [
	{
		name: "google",
		domainPatterns: ["google.com", "google.*/search*"],
		shortDescription: "Extract Google search results with titles, URLs, snippets, and metadata",
		description:
			"Extracts structured data from Google search result pages.\n\n**Returns:**\n- Array of search results with title, URL, snippet, and position\n- Total result count estimate\n- Related searches\n- Featured snippets when available\n\n**Limitations:**\n- Only works on search result pages (not Google homepage)\n- May not capture all rich result types (shopping, images, etc.)",
		examples:
			"// Get all search results on the page\nconst results = google.getSearchResults();\nconsole.log(`Found ${results.items.length} results`);\n\n// Access individual results\nresults.items.forEach((item, i) => {\n  console.log(`${i + 1}. ${item.title}`);\n  console.log(`   ${item.url}`);\n  console.log(`   ${item.snippet}`);\n});\n\n// Get result count\nconsole.log(`Total results: ${results.resultCount}`);\n\n// Get related searches\nconsole.log('Related:', results.relatedSearches);",
		library:
			"// Google Search Results Extractor\nwindow.google = {\n  getSearchResults() {\n    const results = {\n      items: [],\n      resultCount: null,\n      relatedSearches: [],\n      featuredSnippet: null\n    };\n\n    // Get result count\n    const resultStats = document.querySelector('#result-stats');\n    if (resultStats) {\n      const match = resultStats.textContent.match(/([\\d,]+)\\s+results/);\n      if (match) {\n        results.resultCount = match[1];\n      }\n    }\n\n    // Get main search results\n    const searchResults = document.querySelectorAll('#search .g, #rso > div > div');\n    searchResults.forEach((result, index) => {\n      const titleEl = result.querySelector('h3');\n      const linkEl = result.querySelector('a');\n      const snippetEl = result.querySelector('.VwiC3b, .s3v9rd, [data-sncf]');\n\n      if (titleEl && linkEl) {\n        results.items.push({\n          position: index + 1,\n          title: titleEl.textContent,\n          url: linkEl.href,\n          snippet: snippetEl ? snippetEl.textContent : ''\n        });\n      }\n    });\n\n    // Get featured snippet if present\n    const featured = document.querySelector('.kp-blk, .ifM9O');\n    if (featured) {\n      results.featuredSnippet = featured.textContent.trim();\n    }\n\n    // Get related searches\n    const relatedSection = document.querySelector('[data-hveid][data-ved] h3');\n    if (relatedSection && relatedSection.textContent.includes('Related searches')) {\n      const relatedLinks = relatedSection.parentElement.parentElement.querySelectorAll('a');\n      relatedLinks.forEach(link => {\n        results.relatedSearches.push(link.textContent.trim());\n      });\n    }\n\n    return results;\n  }\n};",
		createdAt: "2025-10-10T19:29:11.803Z",
		lastUpdated: "2025-10-10T19:29:11.803Z",
	},
	{
		name: "google-sheets",
		domainPatterns: ["docs.google.com/spreadsheets/**"],
		shortDescription: "Complete Google Sheets automation - read/write cells, format, and manipulate data",
		description:
			'Comprehensive Google Sheets automation with cell/range operations, formatting (bold, italic, underline, alignment, colors, number formats), and data manipulation. Works on both single cells and ranges.\n\n**Key Features:**\n- Read and write individual cells or ranges\n- Format cells with text styling, colors, alignment, and number formats  \n- Set document title\n- Clear entire sheet\n- Get available color palette\n\n**Formatting Options:**\n- Text: bold, italic, underline, strikethrough\n- Alignment: left, center, right\n- Colors: backgroundColor and textColor (use color indices from getAvailableColors())\n- Number formats: currency, percentage\n\n**Notes:**\n- All functions work on macOS (uses Meta/Cmd key)\n- Color buttons may be hidden in "More" menu - automatically handled\n- Formatting uses keyboard shortcuts and native browser events for reliability\n- DOM manipulation used for name box to avoid input conflicts',
		createdAt: "2025-10-12T21:37:37.451Z",
		lastUpdated: "2025-10-13T00:47:36.965Z",
		examples:
			"// Set document title\nawait sheets.setTitle('Sales Report 2024');\n\n// Write data to cells\nawait sheets.setCellValue('A1', 'Product');\nawait sheets.setCellValue('B1', 'Price');\n\n// Write multiple cells at once\nawait sheets.setRange('A1:C3', [\n  ['Name', 'Email', 'Score'],\n  ['Alice', 'alice@test.com', '95'],\n  ['Bob', 'bob@test.com', '87']\n]);\n\n// Read cell values\nconst price = await sheets.getCellValue('B2');\n\n// Read a range as 2D array\nconst data = await sheets.getRange('A1:C3');\ndata.forEach(row => console.log(row.join(', ')));\n\n// Get available colors\nconst colors = await sheets.getAvailableColors();\nconsole.log(colors[0]); // { index: 0, color: 'rgb(0,0,0)', title: 'black' }\n\n// Format a single cell\nawait sheets.format('A1', {\n  bold: true,\n  italic: true,\n  align: 'center'\n});\n\n// Format a range with multiple options\nawait sheets.format('A1:D1', {\n  bold: true,\n  align: 'center',\n  backgroundColor: 0,  // black (from color palette)\n  textColor: 9         // white\n});\n\n// Format numbers as currency\nawait sheets.format('B2:B10', {\n  numberFormat: 'currency'\n});\n\n// Format as percentage\nawait sheets.format('C2:C10', {\n  numberFormat: 'percentage'\n});\n\n// Create a formatted table\nawait sheets.setRange('A1:D4', [\n  ['Product', 'Price', 'Qty', 'Total'],\n  ['Laptop', '999', '5', '4995'],\n  ['Mouse', '25', '20', '500'],\n  ['Keyboard', '75', '10', '750']\n]);\n\n// Format header\nawait sheets.format('A1:D1', {\n  bold: true,\n  align: 'center',\n  backgroundColor: 0,\n  textColor: 9\n});\n\n// Clear entire sheet\nawait sheets.clearAll();\n\n// Navigate to specific cell\nawait sheets.navigateToCell('B5');\n\n// Select a range\nawait sheets.selectRange('A1:D10');\n\n// Get current cell or range\nconst current = sheets.getCurrentCell(); // returns 'A1' or 'A1:D10'",
		library:
			"window.sheets = {\n  getCurrentCell: function() {\n    const nameBox = document.querySelector('#t-name-box');\n    return nameBox?.value || null;\n  },\n\n  getCurrentCellValue: async function() {\n    const formulaBar = document.querySelector('#t-formula-bar-input');\n    return formulaBar?.textContent || '';\n  },\n\n  navigateToCell: async function(cellAddress) {\n    const match = cellAddress.match(/^([A-Z]+)(\\d+)$/);\n    if (!match) throw new Error('Invalid cell address: ' + cellAddress);\n    const nameBox = document.querySelector('#t-name-box');\n    if (nameBox) {\n      nameBox.value = cellAddress;\n      nameBox.dispatchEvent(new Event('input', { bubbles: true }));\n      nameBox.focus();\n    }\n    await nativePress('Enter');\n  },\n\n  selectRange: async function(range) {\n    const nameBox = document.querySelector('#t-name-box');\n    if (nameBox) {\n      nameBox.value = range;\n      nameBox.dispatchEvent(new Event('input', { bubbles: true }));\n      nameBox.focus();\n    }\n    await nativePress('Enter');\n    await new Promise(r => setTimeout(r, 1000));\n  },\n\n  setCellValue: async function(cellAddress, value) {\n    await this.navigateToCell(cellAddress);\n    await nativePress('Backspace');\n    await nativeType('#t-formula-bar-input', String(value));\n    await nativePress('Tab');\n  },\n\n  getCellValue: async function(cellAddress) {\n    const startCell = this.getCurrentCell();\n    await this.navigateToCell(cellAddress);\n    const value = await this.getCurrentCellValue();\n    if (startCell && startCell !== cellAddress) {\n      await this.navigateToCell(startCell);\n    }\n    return value;\n  },\n\n  setTitle: async function(title) {\n    const titleInput = document.querySelector('input[aria-label=\"Rename\"]');\n    if (titleInput) {\n      titleInput.value = title;\n      titleInput.dispatchEvent(new Event('input', { bubbles: true }));\n      titleInput.dispatchEvent(new Event('change', { bubbles: true }));\n      titleInput.focus();\n      await nativePress('Enter');\n      await nativeClick('#waffle-grid-container');\n    }\n  },\n\n  clearAll: async function() {\n    await nativeKeyDown('Meta');\n    await nativeKeyDown('a');\n    await nativeKeyUp('a');\n    await nativeKeyUp('Meta');\n    await nativePress('Backspace');\n  },\n\n  getAvailableColors: async function() {\n    const cellColorBtn = document.querySelector('#t-cell-color');\n    if (cellColorBtn && cellColorBtn.getBoundingClientRect().width === 0) {\n      await nativeClick('#moreButton');\n      await new Promise(r => setTimeout(r, 300));\n    }\n    await nativeClick('#t-cell-color');\n    await new Promise(r => setTimeout(r, 500));\n    \n    const allSwatches = document.querySelectorAll('.docs-material-colorpalette-colorswatch');\n    const visibleSwatches = Array.from(allSwatches).filter(s => {\n      const rect = s.getBoundingClientRect();\n      return rect.width > 0 && rect.height > 0;\n    });\n    \n    const colors = visibleSwatches.map((swatch, index) => ({\n      index: index,\n      color: swatch.style.backgroundColor,\n      title: swatch.getAttribute('title')\n    }));\n    \n    await nativePress('Escape');\n    return colors;\n  },\n\n  format: async function(cellOrRange, options) {\n    await this.selectRange(cellOrRange);\n    await new Promise(r => setTimeout(r, 500));\n    \n    if (options.backgroundColor !== undefined) {\n      const cellColorBtn = document.querySelector('#t-cell-color');\n      if (cellColorBtn && cellColorBtn.getBoundingClientRect().width === 0) {\n        await nativeClick('#moreButton');\n        await new Promise(r => setTimeout(r, 300));\n      }\n      await nativeClick('#t-cell-color');\n      await new Promise(r => setTimeout(r, 500));\n      \n      const allSwatches = document.querySelectorAll('.docs-material-colorpalette-colorswatch');\n      const visibleSwatches = Array.from(allSwatches).filter(s => {\n        const rect = s.getBoundingClientRect();\n        return rect.width > 0 && rect.height > 0;\n      });\n      \n      if (visibleSwatches[options.backgroundColor]) {\n        visibleSwatches[options.backgroundColor].setAttribute('data-temp-target', 'bg');\n        await nativeClick('[data-temp-target=\"bg\"]');\n        visibleSwatches[options.backgroundColor].removeAttribute('data-temp-target');\n        await new Promise(r => setTimeout(r, 300));\n      }\n      \n      await this.selectRange(cellOrRange);\n      await new Promise(r => setTimeout(r, 300));\n    }\n    \n    if (options.textColor !== undefined) {\n      const textColorBtn = document.querySelector('#t-text-color');\n      if (textColorBtn && textColorBtn.getBoundingClientRect().width === 0) {\n        await nativeClick('#moreButton');\n        await new Promise(r => setTimeout(r, 300));\n      }\n      await nativeClick('#t-text-color');\n      await new Promise(r => setTimeout(r, 500));\n      \n      const allSwatches = document.querySelectorAll('.docs-material-colorpalette-colorswatch');\n      const visibleSwatches = Array.from(allSwatches).filter(s => {\n        const rect = s.getBoundingClientRect();\n        return rect.width > 0 && rect.height > 0;\n      });\n      \n      if (visibleSwatches[options.textColor]) {\n        visibleSwatches[options.textColor].setAttribute('data-temp-target', 'text');\n        await nativeClick('[data-temp-target=\"text\"]');\n        visibleSwatches[options.textColor].removeAttribute('data-temp-target');\n        await new Promise(r => setTimeout(r, 300));\n      }\n      \n      await this.selectRange(cellOrRange);\n      await new Promise(r => setTimeout(r, 300));\n    }\n    \n    if (options.bold !== undefined) {\n      await nativeKeyDown('Meta');\n      await nativeKeyDown('b');\n      await nativeKeyUp('b');\n      await nativeKeyUp('Meta');\n      await new Promise(r => setTimeout(r, 200));\n    }\n    \n    if (options.italic !== undefined) {\n      await nativeKeyDown('Meta');\n      await nativeKeyDown('i');\n      await nativeKeyUp('i');\n      await nativeKeyUp('Meta');\n      await new Promise(r => setTimeout(r, 200));\n    }\n    \n    if (options.underline !== undefined) {\n      await nativeKeyDown('Meta');\n      await nativeKeyDown('u');\n      await nativeKeyUp('u');\n      await nativeKeyUp('Meta');\n      await new Promise(r => setTimeout(r, 200));\n    }\n    \n    if (options.strikethrough !== undefined) {\n      await nativeKeyDown('Alt');\n      await nativeKeyDown('Shift');\n      await nativeKeyDown('5');\n      await nativeKeyUp('5');\n      await nativeKeyUp('Shift');\n      await nativeKeyUp('Alt');\n      await new Promise(r => setTimeout(r, 200));\n    }\n    \n    if (options.align === 'left') {\n      await nativeKeyDown('Meta');\n      await nativeKeyDown('Shift');\n      await nativeKeyDown('l');\n      await nativeKeyUp('l');\n      await nativeKeyUp('Shift');\n      await nativeKeyUp('Meta');\n      await new Promise(r => setTimeout(r, 200));\n    } else if (options.align === 'center') {\n      await nativeKeyDown('Meta');\n      await nativeKeyDown('Shift');\n      await nativeKeyDown('e');\n      await nativeKeyUp('e');\n      await nativeKeyUp('Shift');\n      await nativeKeyUp('Meta');\n      await new Promise(r => setTimeout(r, 200));\n    } else if (options.align === 'right') {\n      await nativeKeyDown('Meta');\n      await nativeKeyDown('Shift');\n      await nativeKeyDown('r');\n      await nativeKeyUp('r');\n      await nativeKeyUp('Shift');\n      await nativeKeyUp('Meta');\n      await new Promise(r => setTimeout(r, 200));\n    }\n    \n    if (options.numberFormat === 'currency') {\n      await nativeKeyDown('Meta');\n      await nativeKeyDown('Shift');\n      await nativeKeyDown('4');\n      await nativeKeyUp('4');\n      await nativeKeyUp('Shift');\n      await nativeKeyUp('Meta');\n      await new Promise(r => setTimeout(r, 200));\n    } else if (options.numberFormat === 'percentage') {\n      await nativeKeyDown('Meta');\n      await nativeKeyDown('Shift');\n      await nativeKeyDown('5');\n      await nativeKeyUp('5');\n      await nativeKeyUp('Shift');\n      await nativeKeyUp('Meta');\n      await new Promise(r => setTimeout(r, 200));\n    }\n  },\n\n  _colToNum: function(col) {\n    let num = 0;\n    for (let i = 0; i < col.length; i++) {\n      num = num * 26 + (col.charCodeAt(i) - 64);\n    }\n    return num;\n  },\n\n  _numToCol: function(num) {\n    let col = '';\n    while (num > 0) {\n      const remainder = (num - 1) % 26;\n      col = String.fromCharCode(65 + remainder) + col;\n      num = Math.floor((num - 1) / 26);\n    }\n    return col;\n  },\n\n  getRange: async function(range) {\n    const match = range.match(/^([A-Z]+)(\\d+):([A-Z]+)(\\d+)$/);\n    if (!match) throw new Error('Invalid range format: ' + range);\n    \n    const startCol = this._colToNum(match[1]);\n    const startRow = parseInt(match[2]);\n    const endCol = this._colToNum(match[3]);\n    const endRow = parseInt(match[4]);\n    \n    const result = [];\n    const originalCell = this.getCurrentCell();\n    \n    for (let row = startRow; row <= endRow; row++) {\n      const rowData = [];\n      for (let col = startCol; col <= endCol; col++) {\n        const cellAddress = this._numToCol(col) + row;\n        await this.navigateToCell(cellAddress);\n        const value = await this.getCurrentCellValue();\n        rowData.push(value);\n      }\n      result.push(rowData);\n    }\n    \n    if (originalCell) {\n      await this.navigateToCell(originalCell);\n    }\n    \n    return result;\n  },\n\n  setRange: async function(range, values) {\n    const match = range.match(/^([A-Z]+)(\\d+):([A-Z]+)(\\d+)$/);\n    if (!match) throw new Error('Invalid range format: ' + range);\n    \n    const startCol = this._colToNum(match[1]);\n    const startRow = parseInt(match[2]);\n    const endCol = this._colToNum(match[3]);\n    const endRow = parseInt(match[4]);\n    \n    const expectedRows = endRow - startRow + 1;\n    const expectedCols = endCol - startCol + 1;\n    if (values.length !== expectedRows) {\n      throw new Error(`Expected ${expectedRows} rows, got ${values.length}`);\n    }\n    \n    let rowIdx = 0;\n    for (let row = startRow; row <= endRow; row++) {\n      const rowData = values[rowIdx];\n      if (rowData.length !== expectedCols) {\n        throw new Error(`Row ${rowIdx} expected ${expectedCols} columns, got ${rowData.length}`);\n      }\n      \n      let colIdx = 0;\n      for (let col = startCol; col <= endCol; col++) {\n        const cellAddress = this._numToCol(col) + row;\n        const value = rowData[colIdx];\n        await this.setCellValue(cellAddress, value);\n        colIdx++;\n      }\n      rowIdx++;\n    }\n  }\n}",
	},
	{
		name: "linkedin-engagement",
		domainPatterns: ["linkedin.com/**"],
		shortDescription: "Automate LinkedIn engagement - find your posts and reply to comments",
		description:
			"# LinkedIn Engagement Automation\n\n**IMPORTANT FOR AI:** Multi-step workflow. You orchestrate using navigate tool + browser_javascript/javascript_repl.\n\n## Workflow\n\n### Step 1: Navigate to Activity & Collect Posts\n1. AI: `navigate` to activity page\n2. AI: `browser_javascript` → `linkedin.collectPostsWithPagination(5)` → saves to artifact\n\n### Step 2: For Each Post - Get Comments\n1. AI: `navigate` to post URL\n2. AI: `browser_javascript` → `linkedin.getPostWithCommentTree()` → saves comment tree to artifact\n\n### Step 3: Find Unanswered & Generate Report\nAI: `browser_javascript` (any LinkedIn page) → Load artifact, use `linkedin.findUnansweredComments()`, YOU generate 3 reply options per unanswered comment based on the post and comment context, create markdown report with all options\n\n### Step 4: Post Replies (if user confirms)\n1. AI: `navigate` to post URL\n2. AI: `browser_javascript` → `linkedin.postReply(commentId, text)`\n\n## Functions\n\n### `linkedin.getUsername()`\nReturns username string.\n\n### `linkedin.collectPostsWithPagination(count)`\nReturns array of posts with comments. Auto-filters reposts.\n\n### `linkedin.getPostWithCommentTree()`\nReturns `{ postUrl, postText, totalComments, comments }` where comments is a tree with nested replies. Auto-expands hidden replies.\n\n### `linkedin.findUnansweredComments(commentTree)`\nReturns flat array of comments without your reply.\n\n### `linkedin.postReply(commentId, text)`\nPosts reply to comment. Returns `{ success, commentId, reply }`.",
		createdAt: "2025-10-13T10:24:46.971Z",
		lastUpdated: "2025-10-13T12:54:41.612Z",
		examples:
			"// Step 1: Collect posts (on activity page)\nconst posts = await linkedin.collectPostsWithPagination(5);\nawait createOrUpdateArtifact('data.json', { posts });\n\n// Step 2: Get comment tree (on post page)\nconst result = await linkedin.getPostWithCommentTree();\n// Update artifact with result.comments\n\n// Step 3: Find unanswered and generate report (browser_javascript on any page)\nconst data = await getArtifact('data.json');\ndata.posts.forEach(post => {\n  const unanswered = linkedin.findUnansweredComments(post.commentTree);\n  // YOU generate replies based on post context\n  post.unansweredComments = unanswered;\n});\nawait createOrUpdateArtifact('data.json', data);\n// Create markdown report\n\n// Step 4: Post reply (on post page)\nawait linkedin.postReply('urn:li:comment:123', 'Thanks!');",
		library:
			"window.linkedin = {\n  getUsername: function() {\n    const profileLink = document.querySelector('a[href*=\"/in/\"]');\n    const match = profileLink ? profileLink.href.match(/\\/in\\/([^\\/]+)/) : null;\n    return match ? match[1] : null;\n  },\n\n  collectPostsWithPagination: async function(targetCount = 20) {\n    console.log(`Collecting up to ${targetCount} posts with comments...`);\n    \n    let previousCount = 0;\n    let attempts = 0;\n    const maxAttempts = 50;\n    \n    while (attempts < maxAttempts) {\n      const posts = this.getPostsWithComments();\n      const currentCount = posts.length;\n      \n      console.log(`Attempt ${attempts + 1}: Found ${currentCount} posts with comments`);\n      \n      if (currentCount >= targetCount) {\n        console.log(`Reached target of ${targetCount} posts`);\n        return posts.slice(0, targetCount);\n      }\n      \n      if (currentCount === previousCount && attempts > 0) {\n        console.log('No new posts loaded - reached end of activity');\n        return posts;\n      }\n      \n      previousCount = currentCount;\n      \n      const showMoreBtn = document.querySelector('button.scaffold-finite-scroll__load-button');\n      if (!showMoreBtn) {\n        console.log('No \"Show more\" button found - reached end');\n        return posts;\n      }\n      \n      showMoreBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });\n      await new Promise(r => setTimeout(r, 500));\n      showMoreBtn.click();\n      console.log('Clicked \"Show more results\"');\n      await new Promise(r => setTimeout(r, 2500));\n      attempts++;\n    }\n    \n    console.log(`Reached max attempts (${maxAttempts})`);\n    return this.getPostsWithComments();\n  },\n\n  getPostsWithComments: function() {\n    const posts = document.querySelectorAll('[data-urn*=\"activity\"]');\n    \n    const postsInfo = Array.from(posts).map(post => {\n      const urn = post.getAttribute('data-urn');\n      \n      const repostHeader = post.querySelector('.update-components-header');\n      const isRepost = !!repostHeader;\n      \n      if (isRepost) {\n        return null;\n      }\n      \n      const textElement = post.querySelector('.update-components-text, .feed-shared-text');\n      const text = textElement ? textElement.innerText.trim() : '';\n      \n      const commentButton = post.querySelector('[aria-label*=\"comment\"]');\n      const commentLabel = commentButton ? commentButton.getAttribute('aria-label') : '';\n      const commentText = commentButton ? commentButton.innerText : '';\n      \n      const commentMatch = (commentLabel + commentText).match(/(\\d+)\\s*comment/i);\n      const commentCount = commentMatch ? parseInt(commentMatch[1]) : 0;\n      \n      const postUrl = `https://www.linkedin.com/feed/update/${urn}`;\n      \n      return {\n        urn,\n        postUrl,\n        postText: text.substring(0, 150) + (text.length > 150 ? '...' : ''),\n        commentCount\n      };\n    }).filter(p => p && p.urn && p.commentCount > 0);\n\n    const uniquePosts = Array.from(new Map(postsInfo.map(p => [p.urn, p])).values());\n    return uniquePosts.sort((a, b) => b.commentCount - a.commentCount);\n  },\n\n  getPostWithCommentTree: async function() {\n    const username = this.getUsername();\n    \n    // Get post text\n    const postContent = document.querySelector('.feed-shared-update-v2__description, .update-components-text');\n    const postText = postContent ? postContent.innerText.trim() : '';\n    \n    // First, expand all \"See previous replies\" buttons\n    console.log('Expanding all reply threads...');\n    let expandedCount = 0;\n    let maxAttempts = 20;\n    let attempts = 0;\n    \n    while (attempts < maxAttempts) {\n      const seePreviousButtons = Array.from(document.querySelectorAll('button')).filter(btn => \n        btn.textContent.includes('See previous replies') || \n        btn.textContent.includes('See previous reply') ||\n        btn.textContent.includes('Vorherige Antworten') ||\n        btn.textContent.includes('Voir les réponses précédentes')\n      );\n      \n      if (seePreviousButtons.length === 0) {\n        console.log('No more \"See previous replies\" buttons found');\n        break;\n      }\n      \n      console.log(`Found ${seePreviousButtons.length} \"See previous replies\" buttons`);\n      \n      for (const btn of seePreviousButtons) {\n        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });\n        await new Promise(r => setTimeout(r, 300));\n        btn.click();\n        expandedCount++;\n        console.log(`Clicked button ${expandedCount}`);\n      }\n      \n      // Wait for comments to load - check if DOM changed\n      const commentCountBefore = document.querySelectorAll('article.comments-comment-entity').length;\n      console.log(`Comment count before wait: ${commentCountBefore}`);\n      \n      await new Promise(r => setTimeout(r, 2000));\n      \n      const commentCountAfter = document.querySelectorAll('article.comments-comment-entity').length;\n      console.log(`Comment count after wait: ${commentCountAfter}`);\n      \n      if (commentCountAfter === commentCountBefore) {\n        console.log('No new comments loaded, assuming all expanded');\n        break;\n      }\n      \n      attempts++;\n    }\n    \n    console.log(`Expanded ${expandedCount} reply threads`);\n    \n    // Now extract the comment tree\n    const topLevelComments = [];\n    \n    const extractComment = (article, username) => {\n      const commentId = article.getAttribute('data-id');\n      \n      const profileLink = article.querySelector('a[href*=\"/in/\"][aria-label*=\"View\"]');\n      let authorName = '';\n      let authorUrl = '';\n      \n      if (profileLink) {\n        const ariaLabel = profileLink.getAttribute('aria-label');\n        const nameMatch = ariaLabel.match(/View\\s+(.+?)(?:'s|'s|\\s+•|$)/);\n        authorName = nameMatch ? nameMatch[1].trim().replace(/['']s\\s*(graphic link|profile)/g, '').trim() : '';\n        authorUrl = profileLink.href;\n      }\n      \n      const textElement = article.querySelector('.comments-comment-item__main-content');\n      const text = textElement ? textElement.innerText.trim() : '';\n      \n      const isOwnComment = username && authorUrl.includes(`/in/${username}`);\n      \n      return {\n        commentId,\n        author: authorName,\n        authorUrl,\n        text,\n        isOwnComment,\n        replies: []\n      };\n    };\n    \n    // Get all articles\n    const allArticles = document.querySelectorAll('article.comments-comment-entity');\n    console.log(`Found ${allArticles.length} total articles`);\n    \n    // Filter top-level (not inside thread-item)\n    const topLevelArticles = Array.from(allArticles).filter(article => \n      !article.closest('.comments-thread-item')\n    );\n    \n    console.log(`Found ${topLevelArticles.length} top-level comments`);\n    \n    topLevelArticles.forEach(article => {\n      const comment = extractComment(article, username);\n      \n      // Find replies - they are articles that:\n      // 1. Are descendants of this top-level article\n      // 2. Are inside a .comments-thread-item\n      const allDescendantArticles = article.querySelectorAll('article.comments-comment-entity');\n      const replyArticles = Array.from(allDescendantArticles).filter(a => \n        a.closest('.comments-thread-item') && a !== article\n      );\n      \n      console.log(`  Comment has ${replyArticles.length} replies`);\n      replyArticles.forEach(replyArticle => {\n        const reply = extractComment(replyArticle, username);\n        comment.replies.push(reply);\n      });\n      \n      topLevelComments.push(comment);\n    });\n    \n    return {\n      postUrl: window.location.href,\n      postText,\n      totalComments: document.querySelectorAll('article.comments-comment-entity').length,\n      comments: topLevelComments\n    };\n  },\n\n  findUnansweredComments: function(commentTree) {\n    const unanswered = [];\n    \n    function traverse(commentList, parentComment = null) {\n      commentList.forEach(comment => {\n        if (!comment.isOwnComment) {\n          const hasYourReply = comment.replies.some(r => r.isOwnComment);\n          \n          if (!hasYourReply) {\n            unanswered.push({\n              ...comment,\n              parentComment: parentComment\n            });\n          }\n        }\n        \n        if (comment.replies.length > 0) {\n          traverse(comment.replies, comment);\n        }\n      });\n    }\n    \n    traverse(commentTree);\n    return unanswered;\n  },\n\n  findUnansweredComments: function(commentTree) {\n    const unanswered = [];\n    \n    function traverse(commentList, parentComment = null) {\n      commentList.forEach(comment => {\n        if (!comment.isOwnComment) {\n          const hasYourReply = comment.replies.some(r => r.isOwnComment);\n          \n          if (!hasYourReply) {\n            unanswered.push({\n              ...comment,\n              parentComment: parentComment\n            });\n          }\n        }\n        \n        if (comment.replies.length > 0) {\n          traverse(comment.replies, comment);\n        }\n      });\n    }\n    \n    traverse(commentTree);\n    return unanswered;\n  },\n\n  postReply: async function(commentId, replyText) {\n    const commentArticle = document.querySelector(`[data-id=\"${commentId}\"]`);\n    if (!commentArticle) {\n      throw new Error(`Comment ${commentId} not found`);\n    }\n    \n    commentArticle.scrollIntoView({ behavior: 'smooth', block: 'center' });\n    await new Promise(r => setTimeout(r, 1000));\n    \n    const replyButton = commentArticle.querySelector('button[aria-label*=\"Reply\"]');\n    if (!replyButton) {\n      throw new Error('Reply button not found');\n    }\n    \n    replyButton.click();\n    await new Promise(r => setTimeout(r, 1500));\n    \n    const editors = document.querySelectorAll('.ql-editor[contenteditable=\"true\"]');\n    const replyEditor = editors[editors.length - 1];\n    \n    if (!replyEditor) {\n      throw new Error('Reply editor not found');\n    }\n    \n    replyEditor.focus();\n    await new Promise(r => setTimeout(r, 300));\n    \n    const escapeHtml = (text) => {\n      const div = document.createElement('div');\n      div.textContent = text;\n      return div.innerHTML;\n    };\n    \n    replyEditor.innerHTML = `<p>${escapeHtml(replyText)}</p>`;\n    replyEditor.dispatchEvent(new Event('input', { bubbles: true }));\n    \n    await new Promise(r => setTimeout(r, 500));\n    \n    const form = replyEditor.closest('form');\n    const submitButton = form.querySelector('.comments-comment-box__submit-button--cr') || \n                         form.querySelector('button.artdeco-button--primary');\n    \n    if (!submitButton) {\n      throw new Error('Submit button not found');\n    }\n    \n    if (submitButton.disabled) {\n      throw new Error('Submit button is disabled - reply text may be too short');\n    }\n    \n    submitButton.click();\n    await new Promise(r => setTimeout(r, 2000));\n    \n    return { success: true, commentId, reply: replyText };\n  }\n};",
	},
	{
		name: "whatsapp",
		domainPatterns: ["web.whatsapp.com"],
		shortDescription: "WhatsApp Web automation - list chats, open chats, read messages",
		description:
			"Automate WhatsApp Web operations including listing chats, opening conversations, and reading messages.\n\n**Working Functions:**\n- `listChats()` - Get all chats with unread status (handles virtual scrolling)\n- `openChat(name)` - Search and open a chat by name\n- `getCurrentChat()` - Get current open chat info\n- `getMessages(filterFn)` - Collect messages with filter function control\n  - **Filter function**: `(message) => boolean` - called for each message (newest to oldest)\n  - Returns `true` to continue collecting, `false` to stop\n  - Messages have: `id`, `text`, `timestamp` (Date object), `date` (M/D/YYYY), `sender`, `fromMe`\n  - Automatically scrolls to bottom before/after collection\n- `getUnreadChats()` - Filter chats to show only unread\n- `sendMessage(msg)` - Send a message (use responsibly!)\n\n**Recent Improvements:**\n- ✅ Filter function design - you control when to stop\n- ✅ Collects messages from newest to oldest\n- ✅ Automatically scrolls to absolute bottom before and after\n- ✅ Proper timestamp extraction (removed redundant time field)\n\n**Known Limitations:**\n- `sendMessage()` has not been tested to avoid sending to real chats\n- Loading many messages can take time\n\n**Future Enhancements Needed:**\n- Add attachment handling\n- Test and improve sendMessage safety",
		createdAt: "2025-10-11T20:43:49.023Z",
		lastUpdated: "2025-10-11T21:43:13.279Z",
		examples:
			"// Example 1: Collect last 50 messages\nconst messages = [];\nawait whatsapp.getMessages((msg) => {\n  messages.push(msg);\n  return messages.length < 50; // Stop after 50\n});\nconsole.log(`Got ${messages.length} messages`);\n\n// Example 2: Collect messages from past 7 days\nconst sevenDaysAgo = new Date();\nsevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);\n\nconst recentMessages = [];\nawait whatsapp.getMessages((msg) => {\n  // Collect if within date range\n  if (msg.timestamp && msg.timestamp >= sevenDaysAgo) {\n    recentMessages.push(msg);\n  }\n  // Continue until we find a message older than 7 days\n  return !msg.timestamp || msg.timestamp >= sevenDaysAgo;\n});\n\nconsole.log(`Found ${recentMessages.length} messages from past 7 days`);\n\n// Example 3: Count messages from a specific person\nlet momCount = 0;\nawait whatsapp.getMessages((msg) => {\n  if (msg.sender === 'Mom' && !msg.fromMe) {\n    momCount++;\n  }\n  return momCount < 100; // Stop after finding 100 from mom\n});\n\nconsole.log(`Found ${momCount} messages from Mom`);\n\n// Example 4: Find first message containing text\nlet foundMessage = null;\nawait whatsapp.getMessages((msg) => {\n  if (msg.text.includes('dentist')) {\n    foundMessage = msg;\n    return false; // Stop immediately\n  }\n  return true; // Keep searching\n});\n\n// Other functions\nconst chats = await whatsapp.listChats();\nawait whatsapp.openChat('Mom');\nconst current = whatsapp.getCurrentChat();\n// await whatsapp.sendMessage('Hello');",
		library:
			"window.whatsapp = {\n  \n  // List all chats with unread status (handles virtual scrolling)\n  listChats: async function() {\n    const chatGrid = document.querySelector('div[role=\"grid\"]');\n    if (!chatGrid) {\n      throw new Error('Chat list not found. Make sure WhatsApp is loaded.');\n    }\n    \n    const scrollContainer = document.querySelector('#pane-side');\n    if (!scrollContainer) {\n      throw new Error('Pane-side container not found');\n    }\n    \n    scrollContainer.scrollTop = 0;\n    await new Promise(resolve => setTimeout(resolve, 500));\n    \n    const allChatsSeen = new Map();\n    \n    for (let scrollPos = 0; scrollPos <= scrollContainer.scrollHeight; scrollPos += 500) {\n      scrollContainer.scrollTop = scrollPos;\n      await new Promise(resolve => setTimeout(resolve, 300));\n      \n      const chatItems = Array.from(chatGrid.children);\n      \n      chatItems.forEach(item => {\n        const nameSpan = item.querySelector('span[title]');\n        const name = nameSpan?.getAttribute('title');\n        \n        if (name && !allChatsSeen.has(name)) {\n          const messageSpans = Array.from(item.querySelectorAll('span[dir=\"ltr\"], span[dir=\"auto\"]'));\n          const lastMessage = messageSpans.find(span => \n            span.textContent && \n            span.textContent !== name &&\n            !span.querySelector('svg')\n          )?.textContent;\n          \n          const hasUnread = !!item.querySelector('div[aria-label*=\"unread\"]') ||\n                            !!item.querySelector('span[aria-label*=\"unread\"]');\n          \n          const unreadBadge = item.querySelector('span[aria-label*=\"unread message\"]');\n          const unreadCount = unreadBadge ? parseInt(unreadBadge.getAttribute('aria-label')) : 0;\n          \n          allChatsSeen.set(name, {\n            name,\n            lastMessage: lastMessage?.substring(0, 100),\n            unread: hasUnread,\n            unreadCount\n          });\n        }\n      });\n      \n      if (scrollPos + scrollContainer.clientHeight >= scrollContainer.scrollHeight) {\n        break;\n      }\n    }\n    \n    scrollContainer.scrollTop = 0;\n    return Array.from(allChatsSeen.values());\n  },\n  \n  // Helper function to clear search input\n  _clearSearch: async function() {\n    const closeButton = document.querySelector('#side button[aria-label*=\"Cancel\"]') ||\n                        document.querySelector('#side button[aria-label*=\"Close\"]') ||\n                        document.querySelector('#side span[data-icon=\"x-alt\"]')?.closest('button') ||\n                        document.querySelector('#side span[data-icon=\"x\"]')?.closest('button');\n    \n    if (closeButton) {\n      closeButton.click();\n      await new Promise(resolve => setTimeout(resolve, 500));\n      return;\n    }\n    \n    const searchInput = document.querySelector('#side [contenteditable=\"true\"]');\n    if (!searchInput) {\n      return;\n    }\n    \n    searchInput.focus();\n    await new Promise(resolve => setTimeout(resolve, 100));\n    \n    const escapeEvent = new KeyboardEvent('keydown', {\n      key: 'Escape',\n      code: 'Escape',\n      keyCode: 27,\n      which: 27,\n      bubbles: true,\n      cancelable: true\n    });\n    searchInput.dispatchEvent(escapeEvent);\n    \n    searchInput.textContent = '';\n    searchInput.innerText = '';\n    searchInput.innerHTML = '';\n    \n    const inputEvent = new InputEvent('input', { bubbles: true, cancelable: true });\n    searchInput.dispatchEvent(inputEvent);\n    \n    searchInput.blur();\n    await new Promise(resolve => setTimeout(resolve, 500));\n  },\n  \n  // Open a chat by name (searches and clicks)\n  openChat: async function(name) {\n    await this._clearSearch();\n    \n    const searchSelector = 'div[contenteditable=\"true\"][role=\"textbox\"]';\n    const searchInput = document.querySelector(searchSelector);\n    \n    if (!searchInput) {\n      throw new Error('Search input not found');\n    }\n    \n    searchInput.focus();\n    await new Promise(resolve => setTimeout(resolve, 100));\n    \n    await nativeType(searchSelector, name);\n    await new Promise(resolve => setTimeout(resolve, 1000));\n    \n    const chatGrid = document.querySelector('div[role=\"grid\"]');\n    if (!chatGrid) {\n      throw new Error('Chat grid not found after search');\n    }\n    \n    const firstChat = Array.from(chatGrid.children).find(item => {\n      const nameSpan = item.querySelector('span[title]');\n      const chatName = nameSpan?.getAttribute('title');\n      return chatName && chatName.toLowerCase().includes(name.toLowerCase());\n    });\n    \n    if (!firstChat) {\n      throw new Error(`Chat \"${name}\" not found in search results`);\n    }\n    \n    const chatName = firstChat.querySelector('span[title]')?.getAttribute('title');\n    \n    await nativeClick(`span[title=\"${chatName}\"]`);\n    await new Promise(resolve => setTimeout(resolve, 1000));\n    \n    await this._clearSearch();\n    \n    const openedName = document.querySelector('#main header span[dir=\"auto\"]')?.textContent;\n    \n    return {\n      searched: name,\n      found: chatName,\n      opened: openedName,\n      success: openedName === chatName\n    };\n  },\n  \n  // Get current open chat info\n  getCurrentChat: function() {\n    const main = document.querySelector('#main');\n    if (!main) {\n      return null;\n    }\n    \n    const header = main.querySelector('header');\n    const nameSpan = header?.querySelector('span[dir=\"auto\"]');\n    const chatName = nameSpan?.textContent;\n    \n    if (!chatName) {\n      return null;\n    }\n    \n    const subtitle = header?.querySelector('span[title]')?.getAttribute('title');\n    const isGroup = subtitle?.includes('participant') || subtitle?.includes('member');\n    \n    return {\n      name: chatName,\n      subtitle: subtitle,\n      isGroup: isGroup\n    };\n  },\n  \n  // Collect messages with filter function control\n  // filterFn(message) returns true to continue, false to stop\n  // Only processes messages with both text AND timestamp (skips media-only messages)\n  // Processes messages from NEWEST to OLDEST\n  getMessages: async function(filterFn) {\n    const main = document.querySelector('#main');\n    if (!main) {\n      throw new Error('No chat is open');\n    }\n    \n    const firstMessage = document.querySelector('div[data-id]');\n    if (!firstMessage) {\n      throw new Error('No messages found in chat');\n    }\n    \n    // Find the scrollable message container\n    let scrollContainer = firstMessage.parentElement;\n    let depth = 0;\n    while (scrollContainer && depth < 10) {\n      if (scrollContainer.scrollHeight > scrollContainer.clientHeight) {\n        break;\n      }\n      scrollContainer = scrollContainer.parentElement;\n      depth++;\n    }\n    \n    if (!scrollContainer) {\n      throw new Error('Could not find scrollable message container');\n    }\n    \n    // Helper function to extract message data from DOM element\n    function extractMessageData(msgEl) {\n      const id = msgEl.getAttribute('data-id');\n      \n      // Get text\n      const textEl = msgEl.querySelector('.copyable-text span.selectable-text');\n      const text = textEl ? textEl.textContent : '';\n      \n      // Get timestamp and sender from data-pre-plain-text\n      const prePlainText = msgEl.querySelector('[data-pre-plain-text]');\n      let timestamp = null;\n      let sender = null;\n      let dateStr = null;\n      \n      if (prePlainText) {\n        const plainText = prePlainText.getAttribute('data-pre-plain-text');\n        // Parse: [07:31, 9/29/2025] Muata/Handy: \n        const match = plainText.match(/\\[(\\d{2}:\\d{2}),\\s*(\\d{1,2}\\/\\d{1,2}\\/\\d{4})\\]\\s*([^:]+):/);\n        if (match) {\n          const time = match[1];\n          dateStr = match[2];\n          sender = match[3].trim();\n          \n          // Create full timestamp\n          const [month, day, year] = dateStr.split('/');\n          const [hour, minute] = time.split(':');\n          timestamp = new Date(year, month - 1, day, hour, minute);\n        }\n      }\n      \n      // Check if from current user\n      const fromMe = msgEl.classList.contains('message-out') || \n                     msgEl.closest('.message-out') !== null;\n      \n      return {\n        id,\n        text,\n        timestamp,\n        date: dateStr,\n        sender,\n        fromMe\n      };\n    }\n    \n    // Step 1: Scroll to absolute bottom\n    for (let i = 0; i < 3; i++) {\n      scrollContainer.scrollTop = scrollContainer.scrollHeight;\n      await new Promise(resolve => setTimeout(resolve, 300));\n    }\n    \n    const allMessagesSeen = new Map();\n    let previousScrollTop = scrollContainer.scrollTop;\n    let noNewMessagesCount = 0;\n    let iterations = 0;\n    const maxIterations = 100;\n    let shouldContinue = true;\n    \n    // Step 2: Collect messages from newest to oldest\n    while (shouldContinue && iterations < maxIterations) {\n      iterations++;\n      \n      // Collect currently loaded messages - convert to array for reverse processing\n      const messageElements = Array.from(document.querySelectorAll('div[data-id]'));\n      \n      // Process in REVERSE order (newest first)\n      for (let i = messageElements.length - 1; i >= 0; i--) {\n        const msgEl = messageElements[i];\n        const id = msgEl.getAttribute('data-id');\n        if (!allMessagesSeen.has(id)) {\n          const msgData = extractMessageData(msgEl);\n          \n          // Only process messages with BOTH text AND timestamp\n          // This skips media-only messages (images/videos) that lack full timestamp data\n          if (msgData.text && msgData.timestamp) {\n            allMessagesSeen.set(id, msgData);\n            \n            // Call filter function - returns true to continue, false to stop\n            if (filterFn && typeof filterFn === 'function') {\n              shouldContinue = filterFn(msgData);\n              if (!shouldContinue) {\n                break;\n              }\n            }\n          }\n        }\n      }\n      \n      if (!shouldContinue) break;\n      \n      // Scroll up to load more messages\n      const newScrollTop = Math.max(0, scrollContainer.scrollTop - 500);\n      scrollContainer.scrollTop = newScrollTop;\n      await new Promise(resolve => setTimeout(resolve, 400));\n      \n      // Check if we hit the top - look for \"load older messages\" button\n      if (scrollContainer.scrollTop < 100) {\n        const buttons = Array.from(document.querySelectorAll('button'));\n        const loadButton = buttons.find(btn => \n          btn.textContent.includes('older messages') || \n          btn.textContent.includes('Click here to get')\n        );\n        \n        if (loadButton) {\n          loadButton.click();\n          await new Promise(resolve => setTimeout(resolve, 2000));\n          scrollContainer.scrollTop = 100;\n          noNewMessagesCount = 0;\n          continue;\n        }\n      }\n      \n      // Check if we're stuck\n      if (scrollContainer.scrollTop === previousScrollTop) {\n        noNewMessagesCount++;\n        if (noNewMessagesCount >= 3) {\n          break;\n        }\n      } else {\n        noNewMessagesCount = 0;\n      }\n      previousScrollTop = scrollContainer.scrollTop;\n    }\n    \n    // Step 3: Scroll back to absolute bottom\n    for (let i = 0; i < 3; i++) {\n      scrollContainer.scrollTop = scrollContainer.scrollHeight;\n      await new Promise(resolve => setTimeout(resolve, 200));\n    }\n    \n    return allMessagesSeen.size;\n  },\n  \n  // Get only unread chats\n  getUnreadChats: async function() {\n    const allChats = await this.listChats();\n    return allChats.filter(chat => chat.unread);\n  },\n  \n  // Send a message to current chat\n  sendMessage: async function(message) {\n    const messageBox = document.querySelector('footer div[contenteditable=\"true\"][data-tab=\"10\"]');\n    \n    if (!messageBox) {\n      throw new Error('Message input box not found. Is a chat open?');\n    }\n    \n    await nativeType('footer div[contenteditable=\"true\"][data-tab=\"10\"]', message);\n    await new Promise(resolve => setTimeout(resolve, 500));\n    \n    await nativePress('Enter');\n    await new Promise(resolve => setTimeout(resolve, 500));\n    \n    return {\n      success: true,\n      message: message,\n      chat: this.getCurrentChat()?.name\n    };\n  }\n};",
	},
	{
		createdAt: "2025-10-08T10:18:31.396Z",
		description:
			"Comprehensive YouTube skill for automating video interactions and data extraction.\n\n**Features:**\n- Video playback controls (play/pause, seek, get time/duration)\n- Extract video information (title, channel, views, likes, description)\n- Get full transcripts with timestamps\n- Fetch comments with author, likes, and timestamps\n- Channel info and subscription management\n- Playlist navigation (next/previous video)\n- UI controls (theater mode, fullscreen, captions)\n- Search videos\n\n**Limitations:**\n- Some functions require being on a video page (e.g., playback controls, transcript)\n- Transcript requires manual loading (clicks button automatically)\n- Comments require scrolling to load (done automatically)\n- Description and transcript may take a moment to load",
		domainPatterns: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
		examples:
			"// Video Controls\nwindow.yt.playVideo();\nwindow.yt.pauseVideo();\nwindow.yt.seekTo(30);\nconst time = window.yt.getCurrentTime();\nconst duration = window.yt.getDuration();\n\n// Video Information\nconst info = window.yt.getVideoInfo();\nconst videoId = window.yt.getVideoId();\nconst desc = window.yt.getVideoDescription();\n\n// Transcript\nconst transcript = await window.yt.getTranscript();\n// Returns: [{timestamp: '0:00', text: '...'}, ...]\n\n// Comments\nconst comments = await window.yt.getComments(10);\n// Returns: [{author, text, likes, time}, ...]\n\n// Channel\nconst channelInfo = window.yt.getChannelInfo();\nwindow.yt.subscribeToChannel();\nwindow.yt.clickBellIcon();\n\n// Playlist Navigation\nwindow.yt.nextVideo();\nwindow.yt.previousVideo();\nconst playlist = window.yt.getPlaylistVideos();\n\n// UI Controls\nwindow.yt.toggleTheater();\nwindow.yt.toggleFullscreen();\nwindow.yt.toggleCaptions();\n\n// Search\nwindow.yt.searchVideos('Linus Tech Tips');",
		lastUpdated: "2025-10-08T10:18:31.396Z",
		library:
			"window.yt = {\n  // ===== Video Controls =====\n  playVideo: function() {\n    const video = document.querySelector('video');\n    if (!video) return 'No video found';\n    video.play();\n    return 'Playing';\n  },\n\n  pauseVideo: function() {\n    const video = document.querySelector('video');\n    if (!video) return 'No video found';\n    video.pause();\n    return 'Paused';\n  },\n\n  seekTo: function(seconds) {\n    const video = document.querySelector('video');\n    if (!video) return 'No video found';\n    video.currentTime = seconds;\n    return 'Seeked to ' + seconds + 's';\n  },\n\n  getCurrentTime: function() {\n    const video = document.querySelector('video');\n    if (!video) return 'No video found';\n    return video.currentTime;\n  },\n\n  getDuration: function() {\n    const video = document.querySelector('video');\n    if (!video) return 'No video found';\n    return video.duration;\n  },\n\n  // ===== Video Information =====\n  getVideoInfo: function() {\n    const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim();\n    const channel = document.querySelector('ytd-channel-name yt-formatted-string a')?.textContent?.trim();\n    const views = document.querySelector('ytd-video-view-count-renderer span.view-count')?.textContent?.trim();\n    const likes = document.querySelector('like-button-view-model button[aria-label*=\"like\"]')?.getAttribute('aria-label');\n    const uploadDate = document.querySelector('ytd-video-primary-info-renderer #info-strings yt-formatted-string')?.textContent?.trim();\n    \n    return { title, channel, views, likes, uploadDate };\n  },\n\n  getVideoId: function() {\n    const urlParams = new URLSearchParams(window.location.search);\n    return urlParams.get('v');\n  },\n\n  getVideoDescription: function() {\n    const descElement = document.querySelector('ytd-text-inline-expander yt-attributed-string');\n    return descElement?.textContent?.trim() || 'Description not loaded';\n  },\n\n  // ===== Transcript =====\n  getTranscript: async function() {\n    // Find and click transcript button if not already open\n    let segments = document.querySelectorAll('ytd-transcript-segment-renderer');\n    \n    if (segments.length === 0) {\n      const buttons = document.querySelectorAll('button, yt-button-shape button, ytd-button-renderer button');\n      let transcriptButton = null;\n      \n      for (let btn of buttons) {\n        const text = btn.textContent || btn.getAttribute('aria-label') || '';\n        if (text.includes('transcript') || text.includes('Transcript')) {\n          transcriptButton = btn;\n          break;\n        }\n      }\n      \n      if (transcriptButton) {\n        transcriptButton.click();\n        await new Promise(resolve => setTimeout(resolve, 1500));\n      }\n    }\n    \n    segments = document.querySelectorAll('ytd-transcript-segment-renderer');\n    \n    if (segments.length === 0) {\n      return 'Transcript not available for this video';\n    }\n    \n    const transcript = Array.from(segments).map(seg => ({\n      timestamp: seg.querySelector('.segment-timestamp')?.textContent?.trim(),\n      text: seg.querySelector('.segment-text')?.textContent?.trim()\n    }));\n    \n    return transcript;\n  },\n\n  // ===== Comments =====\n  getComments: async function(limit = 10) {\n    const commentsSection = document.querySelector('ytd-comments#comments');\n    if (commentsSection) {\n      commentsSection.scrollIntoView({ behavior: 'smooth' });\n      await new Promise(resolve => setTimeout(resolve, 2000));\n    }\n    \n    const commentRenderers = document.querySelectorAll('ytd-comment-thread-renderer');\n    \n    if (commentRenderers.length === 0) {\n      return 'Comments not loaded yet';\n    }\n    \n    const comments = Array.from(commentRenderers).slice(0, limit).map(renderer => {\n      const author = renderer.querySelector('#author-text span')?.textContent?.trim();\n      const text = renderer.querySelector('#content-text')?.textContent?.trim();\n      const likes = renderer.querySelector('#vote-count-middle')?.textContent?.trim();\n      const time = renderer.querySelector('.published-time-text a')?.textContent?.trim();\n      \n      return { author, text, likes, time };\n    });\n    \n    return comments;\n  },\n\n  // ===== Channel & Subscription =====\n  getChannelInfo: function() {\n    const channelName = document.querySelector('ytd-channel-name yt-formatted-string a')?.textContent?.trim();\n    const subscriberCount = document.querySelector('#owner-sub-count')?.textContent?.trim();\n    const channelUrl = document.querySelector('ytd-channel-name a')?.href;\n    \n    return {\n      name: channelName,\n      subscribers: subscriberCount,\n      url: channelUrl\n    };\n  },\n\n  subscribeToChannel: function() {\n    const subButton = document.querySelector('ytd-subscribe-button-renderer button, #subscribe-button button');\n    if (!subButton) return 'Subscribe button not found';\n    \n    subButton.click();\n    return 'Clicked subscribe button';\n  },\n\n  clickBellIcon: function() {\n    const bellButton = document.querySelector('ytd-subscription-notification-toggle-button-renderer-next button');\n    if (!bellButton) return 'Bell button not found';\n    \n    bellButton.click();\n    return 'Clicked notification bell';\n  },\n\n  // ===== Playlist & Queue =====\n  nextVideo: function() {\n    const nextButton = document.querySelector('.ytp-next-button');\n    if (!nextButton) return 'Next button not found';\n    \n    nextButton.click();\n    return 'Playing next video';\n  },\n\n  previousVideo: function() {\n    const prevButton = document.querySelector('.ytp-prev-button');\n    if (!prevButton) return 'Previous button not found';\n    \n    prevButton.click();\n    return 'Playing previous video';\n  },\n\n  addToPlaylist: function() {\n    const saveButtons = document.querySelectorAll('button[aria-label]');\n    let saveButton = null;\n    \n    for (let btn of saveButtons) {\n      const label = btn.getAttribute('aria-label');\n      if (label && (label.includes('Save') || label.includes('save'))) {\n        saveButton = btn;\n        break;\n      }\n    }\n    \n    if (!saveButton) return 'Save button not found';\n    \n    saveButton.click();\n    return 'Opened save to playlist menu';\n  },\n\n  getPlaylistVideos: function() {\n    const playlistItems = document.querySelectorAll('ytd-playlist-panel-renderer ytd-playlist-panel-video-renderer');\n    \n    if (playlistItems.length === 0) {\n      return 'Not in a playlist or playlist not visible';\n    }\n    \n    const videos = Array.from(playlistItems).map(item => ({\n      title: item.querySelector('#video-title')?.textContent?.trim(),\n      channel: item.querySelector('#channel-name')?.textContent?.trim(),\n      duration: item.querySelector('#text.ytd-thumbnail-overlay-time-status-renderer')?.textContent?.trim()\n    }));\n    \n    return videos;\n  },\n\n  // ===== UI Controls =====\n  toggleTheater: function() {\n    const theaterBtn = document.querySelector('.ytp-size-button');\n    if (!theaterBtn) return 'Theater button not found';\n    \n    theaterBtn.click();\n    return 'Theater mode toggled';\n  },\n\n  toggleFullscreen: function() {\n    const fullscreenBtn = document.querySelector('.ytp-fullscreen-button');\n    if (!fullscreenBtn) return 'Fullscreen button not found';\n    \n    fullscreenBtn.click();\n    return 'Fullscreen toggled';\n  },\n\n  toggleCaptions: function() {\n    const captionsBtn = document.querySelector('.ytp-subtitles-button');\n    if (!captionsBtn) return 'Captions button not found';\n    \n    captionsBtn.click();\n    return 'Captions toggled';\n  },\n\n  // ===== Search =====\n  searchVideos: function(query) {\n    const searchBox = document.querySelector('input[name=\"search_query\"]');\n    const searchForm = searchBox?.closest('form');\n    \n    if (!searchBox || !searchForm) {\n      return 'Search not available';\n    }\n    \n    searchBox.value = query;\n    searchForm.submit();\n    return 'Searching for: ' + query;\n  }\n};",
		name: "youtube",
		shortDescription:
			"Complete YouTube automation - video controls, info extraction, transcripts, comments, playlists, and more",
	},
];

// Initialize default skills on first run
export async function initializeDefaultSkills() {
	const skillsRepo = getSkills();
	for (const skill of defaultSkills) {
		const existing = await skillsRepo.getSkill(skill.name);
		if (!existing) {
			await skillsRepo.saveSkill(skill);
		}
	}
}

// Get sandbox URL for CSP-compliant code validation
const getSandboxUrl = () => {
	return browser.runtime.getURL("sandbox.html");
};

/**
 * Validate JavaScript syntax using sandboxed iframe (CSP-compliant).
 * Returns { valid: true } or { valid: false, error: string }
 */
async function validateJavaScriptSyntax(code: string): Promise<{ valid: boolean; error?: string }> {
	const sandbox = new SandboxIframe();
	sandbox.sandboxUrlProvider = getSandboxUrl;
	sandbox.style.display = "none";
	document.body.appendChild(sandbox);

	try {
		const result = await sandbox.execute(`syntax-check-${Date.now()}`, code, []);
		sandbox.remove();

		if (!result.success && result.error) {
			return { valid: false, error: result.error.message };
		}

		return { valid: true };
	} catch (error: unknown) {
		sandbox.remove();
		return { valid: false, error: (error as Error).message || "Unknown error" };
	}
}

// IMPORTANT: Use StringEnum for Google API compatibility (NOT Type.Union!)
const skillParamsSchema = Type.Object({
	action: StringEnum(["get", "list", "create", "rewrite", "update", "delete"], {
		description: "Action to perform",
	}),
	name: Type.Optional(Type.String({ description: "Skill name (required for get/rewrite/update/delete)" })),
	url: Type.Optional(
		Type.String({
			description: "URL to filter skills by domain (optional for list action, defaults to current tab URL)",
		}),
	),
	includeLibraryCode: Type.Optional(
		Type.Boolean({
			description:
				"Use with 'get' action to include full library code in output (only necessary if you want to make changes to the library code of a skill)",
		}),
	),
	data: Type.Optional(
		Type.Object({
			name: Type.String({ description: "Unique skill name" }),
			domainPatterns: Type.Array(Type.String(), {
				description:
					"Array of glob patterns (e.g., ['youtube.com', 'youtu.be'] or ['github.com', 'github.com/*/issues']). Include short URLs and domain variations!",
			}),
			shortDescription: Type.String({
				description: "Brief one-line plain text description",
			}),
			description: Type.String({
				description: "Full markdown description (include gotchas/limitations, use markdown formatting)",
			}),
			examples: Type.String({
				description: "Plain JavaScript code examples (will be rendered in code block)",
			}),
			library: Type.String({ description: "JavaScript code to inject" }),
		}),
	),
	updates: Type.Optional(
		Type.Object({
			name: Type.Optional(
				Type.Object({
					old_string: Type.String({
						description: "String to find in skill name",
					}),
					new_string: Type.String({ description: "String to replace it with" }),
				}),
			),
			shortDescription: Type.Optional(
				Type.Object({
					old_string: Type.String({
						description: "String to find in short description",
					}),
					new_string: Type.String({ description: "String to replace it with" }),
				}),
			),
			domainPatterns: Type.Optional(
				Type.Object({
					old_string: Type.String({
						description: "String to find in domain patterns (searches across all patterns)",
					}),
					new_string: Type.String({ description: "String to replace it with" }),
				}),
			),
			library: Type.Optional(
				Type.Object({
					old_string: Type.String({
						description: "String to find in library code",
					}),
					new_string: Type.String({ description: "String to replace it with" }),
				}),
			),
			description: Type.Optional(
				Type.Object({
					old_string: Type.String({
						description: "String to find in description",
					}),
					new_string: Type.String({ description: "String to replace it with" }),
				}),
			),
			examples: Type.Optional(
				Type.Object({
					old_string: Type.String({
						description: "String to find in examples",
					}),
					new_string: Type.String({ description: "String to replace it with" }),
				}),
			),
		}),
	),
});

type SkillParams = Static<typeof skillParamsSchema>;

export const skillTool: AgentTool<typeof skillParamsSchema, any> = {
	label: "Skill Management",
	name: "skill",
	description: SKILL_TOOL_DESCRIPTION,
	parameters: skillParamsSchema,
	execute: async (_toolCallId: string, args: SkillParams) => {
		try {
			const skillsRepo = getSkills();
			const [tab] = await browser.tabs.query({
				active: true,
				currentWindow: true,
			});
			const currentUrl = tab?.url || "";

			switch (args.action) {
				case "get": {
					if (!args.name) {
						return {
							output: "Missing 'name' parameter for get action.",
							isError: true,
							details: {},
						};
					}

					const skill = await skillsRepo.getSkill(args.name);
					if (!skill) {
						// Return list of available skills for current domain
						const available = await skillsRepo.listSkills(currentUrl);
						if (available.length === 0) {
							return {
								output: `Skill '${args.name}' not found. No skills available for current domain.`,
								isError: true,
								details: {},
							};
						}
						const list = available.map((s) => `${s.name}: ${s.shortDescription}`).join("\n");
						return {
							output: `Skill '${args.name}' not found. Available skills:\n${list}`,
							isError: true,
							details: {},
						};
					}

					// Build output based on includeLibraryCode flag
					const domainsStr = skill.domainPatterns.join(", ");
					let llmOutput = `${skill.name} (${domainsStr})\n${skill.description}\n\nExamples:\n${skill.examples}`;

					// Only include library code if explicitly requested
					if (args.includeLibraryCode) {
						llmOutput += `\n\nLibrary:\n${skill.library}`;
					}

					return {
						output: llmOutput,
						isError: false,
						details: skill,
					};
				}

				case "list": {
					// Determine which URL to use for filtering
					// args.url === undefined -> use current tab URL (default)
					// args.url === "" -> list ALL skills (no filtering)
					// args.url === "https://..." -> use specified URL
					const filterUrl = args.url === undefined ? currentUrl : args.url === "" ? undefined : args.url;

					const skillList = await skillsRepo.listSkills(filterUrl);
					if (skillList.length === 0) {
						const msg = filterUrl ? "No skills found for specified domain." : "No skills found.";
						return { output: msg, isError: false, details: { skills: [] } };
					}

					// Token-efficient list for LLM: name: short description
					const llmOutput = skillList.map((s) => `${s.name}: ${s.shortDescription}`).join("\n");
					return {
						output: llmOutput,
						isError: false,
						details: { skills: skillList },
					};
				}

				case "create": {
					if (!args.data) {
						return {
							output: "Missing 'data' parameter for create.",
							isError: true,
							details: {},
						};
					}

					// Check if already exists
					const existing = await skillsRepo.getSkill(args.data.name);
					if (existing) {
						return {
							output: `Skill '${args.data.name}' already exists. Use update action to modify.`,
							isError: true,
							details: {},
						};
					}

					// Validate syntax using sandboxed iframe (CSP-compliant)
					/*const validation = await validateJavaScriptSyntax(args.data.library);
					if (!validation.valid) {
						return {
							output: `Syntax error in library: ${validation.error}`,
							isError: true,
							details: {},
						};
					}*/

					const now = new Date().toISOString();
					const newSkill: Skill = {
						name: args.data.name,
						domainPatterns: args.data.domainPatterns,
						shortDescription: args.data.shortDescription,
						description: args.data.description,
						createdAt: now,
						lastUpdated: now,
						examples: args.data.examples,
						library: args.data.library,
					};

					await skillsRepo.saveSkill(newSkill);

					return {
						output: `Skill '${args.data.name}' created.`,
						isError: false,
						details: newSkill,
					};
				}

				case "rewrite": {
					if (!args.name) {
						return {
							output: "Missing 'name' parameter for rewrite.",
							isError: true,
							details: {},
						};
					}
					if (!args.data) {
						return {
							output: "Missing 'data' parameter for rewrite.",
							isError: true,
							details: {},
						};
					}

					const existing = await skillsRepo.getSkill(args.name);
					if (!existing) {
						return {
							output: `Skill '${args.name}' not found. Use create action.`,
							isError: true,
							details: {},
						};
					}

					// Validate library syntax if provided (using sandboxed iframe)
					if (args.data.library) {
						const validation = await validateJavaScriptSyntax(args.data.library);
						if (!validation.valid) {
							return {
								output: `Syntax error in library: ${validation.error}`,
								isError: true,
								details: {},
							};
						}
					}

					// Check if name is being changed
					const newName = args.data.name;
					if (newName && newName !== existing.name) {
						const existingWithNewName = await skillsRepo.getSkill(newName);
						if (existingWithNewName) {
							return {
								output: `Rewrite failed: Skill with name '${newName}' already exists.`,
								isError: true,
								details: {},
							};
						}
					}

					// Merge with existing (rewrite provided fields)
					const updated: Skill = {
						...existing,
						...args.data,
						name: newName || existing.name, // Allow name change
						createdAt: existing.createdAt, // Keep original creation date
						lastUpdated: new Date().toISOString(),
					};

					// If name changed, delete old and save with new name
					if (newName && newName !== existing.name) {
						await skillsRepo.deleteSkill(args.name);
					}
					await skillsRepo.saveSkill(updated);

					return {
						output: `Skill '${args.name}' rewritten.`,
						isError: false,
						details: updated,
					};
				}

				case "update": {
					if (!args.name) {
						return {
							output: "Missing 'name' parameter for update.",
							isError: true,
							details: {},
						};
					}
					if (!args.updates) {
						return {
							output: "Missing 'updates' parameter for update.",
							isError: true,
							details: {},
						};
					}

					const existing = await skillsRepo.getSkill(args.name);
					if (!existing) {
						return {
							output: `Skill '${args.name}' not found. Use create action.`,
							isError: true,
							details: {},
						};
					}

					// Apply updates to each field
					const updated: Skill = { ...existing };
					let newName: string | undefined;

					if (args.updates.name) {
						const { old_string, new_string } = args.updates.name;
						if (!updated.name.includes(old_string)) {
							return {
								output: `Update failed: old_string not found in name field.`,
								isError: true,
								details: {},
							};
						}
						newName = updated.name.replace(old_string, new_string);
						// Check if new name already exists
						const existingWithNewName = await skillsRepo.getSkill(newName);
						if (existingWithNewName) {
							return {
								output: `Update failed: Skill with name '${newName}' already exists.`,
								isError: true,
								details: {},
							};
						}
						updated.name = newName;
					}

					if (args.updates.shortDescription) {
						const { old_string, new_string } = args.updates.shortDescription;
						if (!updated.shortDescription.includes(old_string)) {
							return {
								output: `Update failed: old_string not found in shortDescription field.`,
								isError: true,
								details: {},
							};
						}
						updated.shortDescription = updated.shortDescription.replace(old_string, new_string);
					}

					if (args.updates.domainPatterns) {
						const { old_string, new_string } = args.updates.domainPatterns;
						updated.domainPatterns = updated.domainPatterns.map((pattern) =>
							pattern.replace(old_string, new_string),
						);
					}

					if (args.updates.library) {
						const { old_string, new_string } = args.updates.library;
						if (!updated.library.includes(old_string)) {
							return {
								output: `Update failed: old_string not found in library field.`,
								isError: true,
								details: {},
							};
						}
						updated.library = updated.library.replace(old_string, new_string);

						// Validate updated library syntax
						const validation = await validateJavaScriptSyntax(updated.library);
						if (!validation.valid) {
							return {
								output: `Update failed: Syntax error in updated library: ${validation.error}`,
								isError: true,
								details: {},
							};
						}
					}

					if (args.updates.description) {
						const { old_string, new_string } = args.updates.description;
						if (!updated.description.includes(old_string)) {
							return {
								output: `Update failed: old_string not found in description field.`,
								isError: true,
								details: {},
							};
						}
						updated.description = updated.description.replace(old_string, new_string);
					}

					if (args.updates.examples) {
						const { old_string, new_string } = args.updates.examples;
						if (!updated.examples.includes(old_string)) {
							return {
								output: `Update failed: old_string not found in examples field.`,
								isError: true,
								details: {},
							};
						}
						updated.examples = updated.examples.replace(old_string, new_string);
					}

					updated.lastUpdated = new Date().toISOString();

					// If name changed, delete old and save with new name
					if (newName) {
						await skillsRepo.deleteSkill(args.name);
					}
					await skillsRepo.saveSkill(updated);

					return {
						output: `Skill '${args.name}' updated.`,
						isError: false,
						details: updated,
					};
				}

				case "delete": {
					if (!args.name) {
						return {
							output: "Missing 'name' parameter for delete.",
							isError: true,
							details: {},
						};
					}

					const existing = await skillsRepo.getSkill(args.name);
					if (!existing) {
						return {
							output: `Skill '${args.name}' not found.`,
							isError: false,
							details: {},
						};
					}

					await skillsRepo.deleteSkill(args.name);
					return {
						output: `Skill '${args.name}' deleted.`,
						isError: false,
						details: { name: args.name },
					};
				}

				default:
					return {
						output: `Unknown action: ${(args as any).action}`,
						isError: true,
						details: {},
					};
			}
		} catch (error: any) {
			return { output: `Error: ${error.message}`, isError: true, details: {} };
		}
	},
};

// Renderer result types
interface SkillResultDetails {
	skills?: Skill[];
	name?: string;
	domainPatterns?: string[];
	shortDescription?: string;
	description?: string;
	examples?: string;
	library?: string;
}

export const skillRenderer: ToolRenderer<SkillParams, SkillResultDetails> = {
	render(
		params: SkillParams | undefined,
		result: ToolResultMessage<SkillResultDetails> | undefined,
	): ToolRenderResult {
		const state = result ? (result.isError ? "error" : "complete") : "inprogress";

		// Helper to render domain pills
		const renderDomainPills = (patterns: string[]) => html`
			<div class="flex flex-wrap gap-2">
				${patterns.map((pattern) => DomainPill(pattern))}
			</div>
		`;

		// Helper to render header text with inline skill pill
		const renderHeaderWithPill = (labelText: string, skillName?: string, skill?: Partial<Skill>): TemplateResult => {
			if (skillName && skill) {
				// Create full Skill object for pill
				const fullSkill: Skill = {
					name: skillName,
					domainPatterns: skill.domainPatterns || [],
					shortDescription: skill.shortDescription || "",
					description: skill.description || "",
					examples: skill.examples || "",
					library: skill.library || "",
					createdAt: skill.createdAt || "",
					lastUpdated: skill.lastUpdated || "",
				};
				return html`<span>${labelText} ${SkillPill(fullSkill, true)}</span>`;
			}
			return html`<span>${labelText}</span>`;
		};

		// Helper to render skill fields (used by create/update/get)
		const renderSkillFields = (skill: Partial<Skill>, showLibrary: boolean) => html`
			${skill.domainPatterns?.length ? renderDomainPills(skill.domainPatterns) : ""}
			${skill.shortDescription ? html`<div class="text-sm text-muted-foreground mt-3">${skill.shortDescription}</div>` : ""}
			${skill.description ? html`<div class="mt-3"><markdown-block .content=${skill.description}></markdown-block></div>` : ""}
			${
				skill.examples
					? html`
				<div class="mt-3">
					<div class="text-sm font-medium text-muted-foreground mb-2">${i18n("Examples")}</div>
					<code-block .code=${skill.examples} language="javascript"></code-block>
				</div>
			`
					: ""
			}
			${
				showLibrary && skill.library
					? html`
				<div class="mt-3">
					<div class="text-sm font-medium text-muted-foreground mb-2">${i18n("Library")}</div>
					<code-block .code=${skill.library} language="javascript"></code-block>
				</div>
			`
					: ""
			}
		`;

		// Error handling
		if (result?.isError) {
			const action = params?.action;
			const skillName = params?.name || params?.data?.name;
			const labels: Record<string, string> = {
				get: i18n("Getting skill"),
				list: i18n("Listing skills"),
				create: i18n("Creating skill"),
				rewrite: i18n("Rewriting skill"),
				update: i18n("Updating skill"),
				delete: i18n("Deleting skill"),
			};
			const headerText = skillName ? `${labels[action!] || action} ${skillName}` : labels[action!] || action || "";

			// For create/rewrite errors, show partial skill data with error at bottom - COLLAPSED BY DEFAULT
			if ((action === "create" || action === "rewrite") && params?.data) {
				const contentRef = createRef<HTMLElement>();
				const chevronRef = createRef<HTMLElement>();
				const skillName = params?.data?.name;

				return {
					content: html`
					<div>
						${renderCollapsibleHeader(state, Sparkles, skillName ? renderHeaderWithPill(headerText, skillName, params.data) : headerText, contentRef, chevronRef, false)}
						<div ${ref(contentRef)} class="overflow-hidden transition-all duration-200 ease-in-out max-h-0 space-y-3">
							${renderSkillFields(params.data, true)}
							<div class="w-full px-3 py-2 text-sm text-destructive bg-destructive/10 border border-destructive rounded">
								${result.output || ""}
							</div>
						</div>
					</div>
				`,
					isCustom: false,
				};
			}

			return {
				content: html`
				<div class="space-y-3">
					${renderHeader(state, Sparkles, headerText)}
					<div class="text-sm text-destructive">${result.output || ""}</div>
				</div>
			`,
				isCustom: false,
			};
		}

		// Full params + result
		if (result && params) {
			const { action } = params;
			const skill = result.details;

			switch (action) {
				case "get": {
					// Show clickable skill pill in header
					if (!skill?.name) {
						return {
							content: renderHeader(state, Sparkles, i18n("No skills found")),
							isCustom: false,
						};
					}

					// Create a full Skill object from the result details
					const fullSkill: Skill = {
						name: skill.name,
						domainPatterns: skill.domainPatterns || [],
						shortDescription: skill.shortDescription || "",
						description: skill.description || "",
						examples: skill.examples || "",
						library: skill.library || "",
						createdAt: "",
						lastUpdated: "",
					};

					const statusIcon = html`<span class="inline-block text-green-600 dark:text-green-500">${icon(Sparkles, "sm")}</span>`;

					return {
						content: html`
						<div class="flex items-center gap-2 text-sm text-muted-foreground">
							${statusIcon}
							<span>${i18n("Got skill")}</span>
							${SkillPill(fullSkill, true)}
						</div>
					`,
						isCustom: false,
					};
				}

				case "list": {
					// Show "Skills for <domain>" header + skill pills
					const skills = skill?.skills || [];
					if (skills.length === 0) {
						return {
							content: renderHeader(state, Sparkles, i18n("No skills found")),
							isCustom: false,
						};
					}

					// Get domain from first skill
					const domain = skills[0]?.domainPatterns?.[0] || "";
					const statusIcon = html`<span class="inline-block text-green-600 dark:text-green-500">${icon(Sparkles, "sm")}</span>`;

					return {
						content: html`
						<div class="space-y-3">
							<div class="flex items-center gap-2 text-sm text-muted-foreground">
								${statusIcon}
								<span>${i18n("Skills for domain")}</span>
								${domain ? DomainPill(domain) : ""}
							</div>
							<div class="flex flex-wrap gap-2">
								${skills.map((s) => SkillPill(s, true))}
							</div>
						</div>
					`,
						isCustom: false,
					};
				}

				case "create":
				case "rewrite": {
					// Show all skill fields (including library) - COLLAPSED BY DEFAULT
					// Skill data comes from result.details (full Skill object)
					const skillData = skill || params.data || {};
					const skillName = skillData.name;
					if (!skillName) {
						return {
							content: renderHeader(state, Sparkles, i18n("Processing skill...")),
							isCustom: false,
						};
					}

					const labelText =
						action === "create"
							? state === "complete"
								? i18n("Created skill")
								: i18n("Creating skill")
							: state === "complete"
								? i18n("Rewritten skill")
								: i18n("Rewriting skill");

					const contentRef = createRef<HTMLElement>();
					const chevronRef = createRef<HTMLElement>();

					return {
						content: html`
						<div>
							${renderCollapsibleHeader(state, Sparkles, renderHeaderWithPill(labelText, skillName, skillData), contentRef, chevronRef, false)}
							<div ${ref(contentRef)} class="overflow-hidden transition-all duration-200 ease-in-out max-h-0">
								${renderSkillFields(skillData, true)}
							</div>
						</div>
					`,
						isCustom: false,
					};
				}

				case "update": {
					// Show diffs for updated fields
					const skillName = params.name;
					if (!skillName) {
						return {
							content: renderHeader(state, Sparkles, i18n("Processing skill...")),
							isCustom: false,
						};
					}

					const labelText = state === "complete" ? i18n("Updated skill") : i18n("Updating skill");
					const contentRef = createRef<HTMLElement>();
					const chevronRef = createRef<HTMLElement>();

					const updates = params.updates || {};
					// Use the full skill from result.details if available, otherwise just the name
					const skillData = skill || { name: skillName };

					return {
						content: html`
						<div>
							${renderCollapsibleHeader(state, Sparkles, renderHeaderWithPill(labelText, skillName, skillData), contentRef, chevronRef, false)}
							<div ${ref(contentRef)} class="overflow-hidden transition-all duration-200 ease-in-out max-h-0 space-y-3">
								${
									updates.library
										? html`
									<div>
										<div class="text-sm font-medium text-muted-foreground mb-2">${i18n("Library")}</div>
										${Diff({ oldText: updates.library.old_string, newText: updates.library.new_string })}
									</div>
								`
										: ""
								}
								${
									updates.description
										? html`
									<div>
										<div class="text-sm font-medium text-muted-foreground mb-2">Description</div>
										${Diff({ oldText: updates.description.old_string, newText: updates.description.new_string })}
									</div>
								`
										: ""
								}
								${
									updates.examples
										? html`
									<div>
										<div class="text-sm font-medium text-muted-foreground mb-2">${i18n("Examples")}</div>
										${Diff({ oldText: updates.examples.old_string, newText: updates.examples.new_string })}
									</div>
								`
										: ""
								}
							</div>
						</div>
					`,
						isCustom: false,
					};
				}

				case "delete": {
					// Show "Deleted skill" with pill in header row
					const skillName = params.name;
					const statusIcon = html`<span class="inline-block text-green-600 dark:text-green-500">${icon(Sparkles, "sm")}</span>`;
					return {
						content: html`
						<div class="flex items-center gap-2 text-sm text-muted-foreground">
							${statusIcon}
							<span>${i18n("Deleted skill")}</span>
							${skillName ? SkillPill(skillName) : ""}
						</div>
					`,
						isCustom: false,
					};
				}

				default:
					return {
						content: renderHeader(state, Sparkles, result.output || ""),
						isCustom: false,
					};
			}
		}

		// Params only (streaming)
		if (params) {
			const { action, name, data } = params;

			switch (action) {
				case "create":
				case "rewrite": {
					// Show streaming skill fields as they come in
					const skillName = data?.name || name;
					if (!skillName) {
						const labels: Record<string, string> = {
							create: i18n("Creating skill"),
							rewrite: i18n("Rewriting skill"),
						};
						return {
							content: renderHeader(state, Sparkles, labels[action] || ""),
							isCustom: false,
						};
					}

					const labels: Record<string, string> = {
						create: i18n("Creating skill"),
						rewrite: i18n("Rewriting skill"),
					};
					const labelText = labels[action];

					const contentRef = createRef<HTMLElement>();
					const chevronRef = createRef<HTMLElement>();

					return {
						content: html`
						<div>
							${renderCollapsibleHeader(state, Sparkles, renderHeaderWithPill(labelText, skillName, data), contentRef, chevronRef, false)}
							<div ${ref(contentRef)} class="overflow-hidden transition-all duration-200 ease-in-out max-h-0">
								${data ? renderSkillFields(data, true) : ""}
							</div>
						</div>
					`,
						isCustom: false,
					};
				}
				case "update": {
					// Show streaming diffs as they come in
					const skillName = name;
					if (!skillName) {
						return {
							content: renderHeader(state, Sparkles, i18n("Updating skill")),
							isCustom: false,
						};
					}

					const labelText = i18n("Updating skill");
					const contentRef = createRef<HTMLElement>();
					const chevronRef = createRef<HTMLElement>();
					const updates = params.updates || {};
					const skillData = { name: skillName };

					return {
						content: html`
						<div>
							${renderCollapsibleHeader(state, Sparkles, renderHeaderWithPill(labelText, skillName, skillData), contentRef, chevronRef, false)}
							<div ${ref(contentRef)} class="overflow-hidden transition-all duration-200 ease-in-out max-h-0 space-y-3">
								${
									updates.library
										? html`
									<div>
										<div class="text-sm font-medium text-muted-foreground mb-2">${i18n("Library")}</div>
										${Diff({ oldText: updates.library.old_string, newText: updates.library.new_string })}
									</div>
								`
										: ""
								}
								${
									updates.description
										? html`
									<div>
										<div class="text-sm font-medium text-muted-foreground mb-2">Description</div>
										${Diff({ oldText: updates.description.old_string, newText: updates.description.new_string })}
									</div>
								`
										: ""
								}
								${
									updates.examples
										? html`
									<div>
										<div class="text-sm font-medium text-muted-foreground mb-2">${i18n("Examples")}</div>
										${Diff({ oldText: updates.examples.old_string, newText: updates.examples.new_string })}
									</div>
								`
										: ""
								}
							</div>
						</div>
					`,
						isCustom: false,
					};
				}
				default: {
					const skillName = name || data?.name;
					const labels: Record<string, string> = {
						get: i18n("Getting skill"),
						list: i18n("Listing skills"),
						delete: i18n("Deleting skill"),
					};
					const headerText = skillName
						? `${labels[action] || action} ${skillName}`
						: labels[action] || action || "";
					return {
						content: renderHeader(state, Sparkles, headerText),
						isCustom: false,
					};
				}
			}
		}

		// No params, no result
		return {
			content: renderHeader(state, Sparkles, i18n("Processing skill...")),
			isCustom: false,
		};
	},
};

registerToolRenderer(skillTool.name, skillRenderer);
