# KRONOS DOCUMENTS & NOTES — DATA MODEL SPECIFICATION

## 1. Relational Entity Overview

The documents platform schema integrates directly with existing `User`, `Session`, `Workspace`, and `WorkspaceMember` models in `prisma/schema.prisma`.

```
                    ┌──────────────────┐
                    │       User       │
                    └─────────┬────────┘
                              │ 1:N
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Workspace   │◄────►│  Workspace   │      │ Document     │
│              │      │  Member      │      │ Comment      │
└───────┬──────┘      └──────────────┘      └──────────────┘
        │ 1:N
        ├───────────────────────────────────────────┐
        ▼                                           ▼
┌──────────────┐                            ┌──────────────┐
│    Folder    │                            │   Document   │
└───────┬──────┘                            └───────┬──────┘
        │ 1:N                                       │ 1:N
        └───────────────────────────────────────────┤
                                                    ├──────────────► DocumentRevision
                                                    ├──────────────► DocumentAttachment
                                                    ├──────────────► DocumentTagAssignment
                                                    ├──────────────► DocumentFavorite
                                                    ├──────────────► DocumentActivity
                                                    └──────────────► DocumentShare
```

---

## 2. Model Definitions

### `Document`
- `id`: String (`cuid()`), Primary Key
- `workspaceId`: String, Foreign Key -> `Workspace.id`
- `creatorId`: String, Foreign Key -> `User.id`
- `folderId`: String?, Foreign Key -> `Folder.id`
- `parentId`: String?, Self-relation -> `Document.id` (Nested pages)
- `title`: String (default `"Untitled"`)
- `icon`: String? (Emoji or monochrome icon identifier)
- `coverImage`: String? (URL / storage reference)
- `content`: Json (Structured TipTap document tree)
- `plainText`: String? (Stripped text for full-text search indexing)
- `status`: Enum `DocumentStatus` (`DRAFT`, `PUBLISHED`, `ARCHIVED`)
- `version`: Int (default `1`, for Optimistic Concurrency Control)
- `orderIndex`: Float (default `0`, for fractional drag-and-drop reordering)
- `isFullWidth`: Boolean (default `false`)
- `isFavorite`: Boolean (default `false`)
- `isPinned`: Boolean (default `false`)
- `isArchived`: Boolean (default `false`)
- `isDeleted`: Boolean (default `false`, soft-deletion)
- `deletedAt`: DateTime?
- `createdAt`: DateTime (`now()`)
- `updatedAt`: DateTime (`updatedAt`)

### `Folder`
- `id`: String (`cuid()`), Primary Key
- `workspaceId`: String, Foreign Key -> `Workspace.id`
- `creatorId`: String, Foreign Key -> `User.id`
- `parentId`: String?, Self-relation -> `Folder.id` (Subfolders)
- `name`: String
- `icon`: String?
- `color`: String?
- `orderIndex`: Float (default `0`)
- `createdAt`: DateTime (`now()`)
- `updatedAt`: DateTime (`updatedAt`)

### `DocumentRevision`
- `id`: String (`cuid()`), Primary Key
- `documentId`: String, Foreign Key -> `Document.id`
- `creatorId`: String, Foreign Key -> `User.id`
- `version`: Int
- `title`: String
- `content`: Json
- `description`: String? (e.g. "Autosave", "Manual Snapshot", "Rollback")
- `createdAt`: DateTime (`now()`)

### `DocumentAttachment`
- `id`: String (`cuid()`), Primary Key
- `documentId`: String, Foreign Key -> `Document.id`
- `uploaderId`: String, Foreign Key -> `User.id`
- `filename`: String
- `mimeType`: String
- `size`: Int (bytes)
- `storageKey`: String (unique storage identifier or local path)
- `url`: String
- `createdAt`: DateTime (`now()`)

### `DocumentTemplate`
- `id`: String (`cuid()`), Primary Key
- `workspaceId`: String?, Foreign Key -> `Workspace.id` (null = System template)
- `creatorId`: String?, Foreign Key -> `User.id`
- `name`: String
- `description`: String?
- `category`: String (e.g. "Engineering", "Product", "Personal")
- `icon`: String?
- `content`: Json
- `isSystem`: Boolean (default `false`)
- `createdAt`: DateTime (`now()`)
- `updatedAt`: DateTime (`updatedAt`)

### `DocumentTag` & `DocumentTagAssignment`
- `DocumentTag`: `id`, `workspaceId`, `name`, `color`
- `DocumentTagAssignment`: `documentId`, `tagId`, Primary Key `(documentId, tagId)`

### `DocumentComment`
- `id`: String (`cuid()`), Primary Key
- `documentId`: String, Foreign Key -> `Document.id`
- `authorId`: String, Foreign Key -> `User.id`
- `parentId`: String? (for threaded replies)
- `content`: String
- `selectedText`: String? (highlighted text anchor)
- `isResolved`: Boolean (default `false`)
- `createdAt`: DateTime (`now()`)
- `updatedAt`: DateTime (`updatedAt`)

### `DocumentActivity`
- `id`: String (`cuid()`), Primary Key
- `documentId`: String, Foreign Key -> `Document.id`
- `userId`: String, Foreign Key -> `User.id`
- `action`: String (e.g. `CREATED`, `UPDATED`, `COMMENTED`, `ARCHIVED`, `RESTORED`)
- `metadata`: Json?
- `createdAt`: DateTime (`now()`)
