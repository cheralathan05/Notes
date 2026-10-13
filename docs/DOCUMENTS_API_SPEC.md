# KRONOS DOCUMENTS & NOTES — REST API SPECIFICATION

All endpoints require authentication via the `session_token` cookie through `authMiddleware`. Workspace ownership and membership are verified on every call.

---

## 1. Document Management (`/api/documents`)

### `GET /api/documents`
- **Query Params**: `workspaceId` (required), `folderId` (optional), `parentId` (optional), `status` (optional), `isFavorite` (optional), `isArchived` (optional), `isDeleted` (optional)
- **Response**: `{ success: true, data: { documents: Document[] } }`

### `POST /api/documents`
- **Body**: `{ workspaceId, folderId?, parentId?, title?, icon?, content?, templateId? }`
- **Response**: `{ success: true, data: { document: Document } }`

### `GET /api/documents/:id`
- **Response**: `{ success: true, data: { document: DocumentWithDetails } }` (includes tags, attachments, author metadata)

### `PUT /api/documents/:id`
- **Body**: `{ title?, content?, plainText?, icon?, coverImage?, isFullWidth?, status?, version?, folderId?, parentId?, orderIndex? }`
- **Concurrency**: Checks `version`. If client version < server version, returns `409 Conflict`.
- **Response**: `{ success: true, data: { document: Document } }`

### `DELETE /api/documents/:id`
- **Query Params**: `permanent=true|false` (default: soft delete to trash)
- **Response**: `{ success: true, data: { message: "Document deleted" } }`

### `POST /api/documents/:id/restore`
- **Response**: `{ success: true, data: { document: Document } }`

### `POST /api/documents/:id/duplicate`
- **Response**: `{ success: true, data: { document: Document } }`

### `POST /api/documents/:id/favorite`
- **Body**: `{ isFavorite: boolean }`
- **Response**: `{ success: true, data: { document: Document } }`

### `POST /api/documents/reorder`
- **Body**: `{ items: Array<{ id: string, orderIndex: number, folderId?: string | null, parentId?: string | null }> }`
- **Response**: `{ success: true, data: { count: number } }`

---

## 2. Revisions (`/api/documents/:id/revisions`)

### `GET /api/documents/:id/revisions`
- **Response**: `{ success: true, data: { revisions: DocumentRevision[] } }`

### `POST /api/documents/:id/revisions/:revisionId/restore`
- **Response**: `{ success: true, data: { document: Document } }`

---

## 3. Folders (`/api/folders`)

### `GET /api/folders`
- **Query Params**: `workspaceId` (required)
- **Response**: `{ success: true, data: { folders: Folder[] } }`

### `POST /api/folders`
- **Body**: `{ workspaceId, name, icon?, color?, parentId? }`
- **Response**: `{ success: true, data: { folder: Folder } }`

### `PUT /api/folders/:id`
- **Body**: `{ name?, icon?, color?, parentId? }`
- **Response**: `{ success: true, data: { folder: Folder } }`

### `DELETE /api/folders/:id`
- **Response**: `{ success: true, data: { message: "Folder deleted" } }`

---

## 4. Templates (`/api/templates`)

### `GET /api/templates`
- **Query Params**: `workspaceId` (optional, returns system templates + workspace templates)
- **Response**: `{ success: true, data: { templates: DocumentTemplate[] } }`

### `POST /api/templates`
- **Body**: `{ workspaceId, name, description?, category, icon?, content }`
- **Response**: `{ success: true, data: { template: DocumentTemplate } }`

---

## 5. File Attachments (`/api/documents/:id/attachments`)

### `POST /api/documents/:id/attachments`
- **Multipart Form**: `file` (single or multiple)
- **Response**: `{ success: true, data: { attachment: DocumentAttachment } }`

### `DELETE /api/documents/:id/attachments/:attachmentId`
- **Response**: `{ success: true, data: { message: "Attachment removed" } }`

---

## 6. Global Search (`/api/search`)

### `GET /api/search`
- **Query Params**: `workspaceId` (required), `q` (query string), `tagId?`, `status?`
- **Response**: `{ success: true, data: { results: Array<{ id, title, plainText, icon, updatedAt, matches }> } }`

---

## 7. AI Document Assistant (`/api/ai/documents`)

### `POST /api/ai/documents/execute`
- **Body**: `{ action: "summarize" | "rewrite" | "grammar" | "tone" | "continue" | "actions" | "qa", content: string, tone?: string, query?: string }`
- **Response**: `{ success: true, data: { result: string } }`

---

## 8. Export & Import (`/api/documents/:id/export` and `/api/documents/import`)

### `GET /api/documents/:id/export`
- **Query Params**: `format: "markdown" | "html" | "txt" | "pdf" | "docx"`
- **Response**: File binary / stream with appropriate `Content-Disposition`.

### `POST /api/documents/import`
- **Multipart Form**: `file`, `workspaceId`, `folderId?`
- **Response**: `{ success: true, data: { document: Document } }`
