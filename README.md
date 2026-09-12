# 日記小屋：GitHub Pages + Google 試算表

GitHub 只保存程式與公開插畫，不保存日記或密碼。Google Apps Script 在伺服器驗證密碼，每次資料讀寫都需要有期限的簽章通行證。閱讀者可以閱讀、留言及按愛心；只有主人可以寫日記。GitHub Pages 的密碼畫面本身公開，日記 API 並不公開。

## Google 端（必須完成才能登入）

在既有「日記小屋資料存取」Apps Script 專案操作，**不要修改告白小遊戲的專案**。

1. 用 `google-drive/Pages.gs` 全文取代原本 `Code.gs`，不要與舊版並存。此檔在公開儲存庫也可供複製。
2. 專案設定 → 顯示 `appsscript.json`，用 `google-drive/appsscript.pages.json` 取代該資訊清單的內容。
3. 專案設定 → 指令碼屬性，新增下列三筆（值不要貼到 GitHub 或聊天）：

   | 屬性 | 值 |
   | --- | --- |
   | `COTTAGE_SHEET_ID` | 原本試算表網址 `/d/` 與 `/edit` 之間的 ID |
   | `COTTAGE_READER_PASSWORD` | 分享給讀者的密碼，16–256 字元 |
   | `COTTAGE_OWNER_PASSWORD` | 只有主人知道的另一組密碼，16–256 字元 |

   建議使用密碼管理器產生兩組不同的隨機密碼；不要使用人名、生日或重複使用其他帳號密碼。
4. 在編輯器執行 `setupCottage_` 並親自完成 Google 授權。它只核對三個既有分頁及初始化簽章密鑰、作者 ID，不覆蓋日記內容。
5. 部署 → 管理部署作業 → 編輯 → 版本選「新版本」→ 部署。沿用原 `/exec` 網址；執行身分為「我」，存取對象為「所有人」。不要把 Google 試算表設為公開。
6. 這份資訊清單啟用 Sheets 進階服務。若使用自訂 Google Cloud 專案，亦需在該專案啟用 Google Sheets API。
7. 在 GitHub Pages 實測：無密碼不能讀取；閱讀密碼不能書寫；主人可寫入一篇測試日記，重新登入後仍可讀取。

不用設定 Sites 或 GitHub Secrets。`COTTAGE_BRIDGE_SECRET` 只留在 Google 指令碼屬性。修改任何一組密碼會撤銷所有既有通行證；若疑似通行證洩漏，亦可更換此簽章密鑰。

## GitHub Pages 發布

本儲存庫的 `docs/` 是已建置靜態網站。到 Settings → Pages → Build and deployment → Deploy from a branch，選 `main` 與 `/docs`，儲存。不要選根目錄；根目錄是程式原始碼。

開發需要 Node.js 22.13 以上：

```sh
npm ci
npm run build
```

建置後把 `dist-pages/` 內容放入 `docs/` 再提交。前端預設路徑是 `/qingjournal/`；若改儲存庫名稱，需同步修改 `vite.pages.config.ts` 的 `base`。若改 GitHub 帳號，也需修改 `Pages.gs` 的 `PAGES_ORIGIN`。

## 隱私與限制

- 密碼、通行證和日記不放在網址、原始碼、localStorage 或 sessionStorage。只有非機密的匿名訪客 ID 保存在 localStorage。
- 通行證只存在目前分頁的記憶體。讀者一小時、主人半小時後需重新輸入密碼。重新整理或關閉分頁也會鎖上。
- 尚未同步的草稿只留在分頁記憶體，重新整理或關閉會遺失。儲存失敗請下載草稿備份；備份是明文私人檔案，勿上傳 GitHub。過期後重新用主人密碼登入，可處理未關閉分頁內的草稿。
- 多裝置同時修改同一篇日記會拒絕覆蓋，必須先下載草稿，再載入最新版比對。不要同時在舊 Sites 與新版網站寫日記；兩者不是自動雙向同步。
- 原先三個分頁保留，不變更舊遊戲「回覆」分頁。切換前需再次比對原資料庫，補入期間新增資料，且不可直接覆蓋試算表現有修改。
- Sheet 的 `public` 欄位是舊資料格式；在這版 API 仍必須通過閱讀密碼才能取得任何日記。沒有任何匿名公開讀取端點。
- 登入每個角色五分鐘最多十次錯誤嘗試，超過暫停登入。這是共享密碼，持有人能轉傳密碼、複製已讀資料，無法防止已授權讀者另存。
- 這不是端對端加密；Google 帳號持有人與有試算表權限的人仍可讀取日記。Apps Script 配額與第三方 iframe 限制可能影響連線；失敗時不繞過驗證。
- Sheets 每篇正文及富文字 JSON 各限制 45,000 字元，留言最多 2,000 字。分頁列數用完時，需自行新增列。
- 請勿在此 GitHub 帳號的其他 Pages 網站執行不可信程式碼；同帳號 Pages 專案共用瀏覽器 origin。

目前舊 Sites 不會被此儲存庫停用、刪除或同步；完成新站驗證後再決定是否停用舊站。
