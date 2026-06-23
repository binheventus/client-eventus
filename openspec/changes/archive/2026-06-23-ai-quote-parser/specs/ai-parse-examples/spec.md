# Spec: ai-parse-examples

## ADDED Requirements

### Requirement: AI parse examples persisted in MySQL

The system SHALL persist a list of AI parse training examples in a MySQL table `pricing_ai_parse_examples`. Each example contains a unique kebab-case `name`, the original `input_text` brief, the desired `expected_output` JSON, optional admin `notes`, an `is_active` flag, a `sort_order`, and standard `created_at`/`updated_at` timestamps. Examples are loaded at runtime by the AI parser and concatenated with the foundational hardcoded examples before being sent to Claude.

#### Scenario: Schema and unique constraint

- **WHEN** a new example is inserted with a `name` that already exists
- **THEN** the database returns a unique-key violation and the API responds with HTTP 409 and code `DUPLICATE_RECORD`

#### Scenario: Empty input or output rejected

- **WHEN** a client sends a create request without `input_text` or with an `expected_output` that is not valid JSON
- **THEN** the API responds with HTTP 400 and a Vietnamese validation error message

### Requirement: Examples managed via Pricing Admin

`/pricing-admin` SHALL expose a new tab "AI Examples" that uses the existing dataset-driven CRUD framework. Admins can list, search, create, edit, toggle active, and delete examples. The form for `expected_output` MUST validate JSON before submission so admins cannot save malformed payloads.

#### Scenario: Admin lists all examples sorted

- **WHEN** an authenticated admin opens the AI Examples tab
- **THEN** the page shows all rows ordered by `sort_order` ascending, with active rows highlighted

#### Scenario: Admin disables a misleading example

- **WHEN** the admin toggles `is_active = false` for a row and saves
- **THEN** subsequent AI parse requests do NOT include that example in the prompt within the cache TTL window

#### Scenario: Admin saves invalid JSON

- **WHEN** the admin enters non-JSON text in the `expected_output` field and clicks save
- **THEN** the form shows a Vietnamese error and prevents submission until the JSON is valid

### Requirement: Active examples loaded into AI prompt

The AI parser MUST fetch active examples from the cache (TTL 5 minutes), merge them with the foundational hardcoded examples, sort by `sort_order`, cap at `MAX_EXAMPLES` (default 12), and emit a "EXAMPLES" section in the system prompt. The cap exists so the prompt does not grow unbounded as admins add examples.

#### Scenario: Foundational and custom examples merged

- **WHEN** there are 5 foundational examples and 3 active custom examples
- **THEN** all 8 are emitted in the prompt, ordered by `sort_order`

#### Scenario: Cap applied when too many active examples

- **WHEN** there are 5 foundational examples and 20 active custom examples (total 25)
- **THEN** only the top 12 by `sort_order` are emitted; the remaining 13 are skipped

### Requirement: Cache invalidation on example changes

`POST`, `PATCH`, and `DELETE` to `/api/pricing-admin?resource=ai_parse_examples` MUST invalidate the in-memory examples cache so the next AI parse picks up the change without waiting 5 minutes.

#### Scenario: Newly added example takes effect on next parse

- **WHEN** an admin saves a new example via Pricing Admin, then a sales user submits an AI parse request immediately
- **THEN** the prompt sent to Claude includes the new example

### Requirement: "Save as example" button on AI parse result

After a successful AI parse on `/quotes/new`, the page SHALL display a "📚 Lưu thành ví dụ huấn luyện" button. Clicking it opens a modal that snapshots the current state of items and quote-level fields (location, duration_hours, tier_code) as the `expected_output`. The modal pre-fills `name` with a kebab-case slug derived from date and a short token. Sales can adjust the snapshot, fill `notes`, then save — which calls the same `POST /api/pricing-admin` endpoint as the admin tab.

#### Scenario: Sales saves example after fixing items

- **WHEN** sales has edited the items table to the correct shape after AI parse, then clicks "Lưu thành ví dụ"
- **THEN** the modal opens with `input_text` = the current brief, `expected_output` = a JSON serialization of the current items + location + duration_hours + tier_code, and a default `name` like `chat-20260622-a4f9`

#### Scenario: Sales saves successfully → row appears in admin

- **WHEN** sales submits the modal with valid name + JSON
- **THEN** a 201 response is returned and the row appears in `/pricing-admin` AI Examples tab

#### Scenario: Sales cancels modal

- **WHEN** sales opens the modal then clicks Cancel
- **THEN** no API call is made and the page state is unchanged

### Requirement: Active flag respected by loader

The examples loader MUST filter out rows where `is_active = false` regardless of `sort_order`. Disabled rows are kept in the database for audit but never sent to Claude.

#### Scenario: Disabled foundational equivalent ignored

- **WHEN** an admin disables a custom example that overlaps semantically with a foundational example
- **THEN** only the foundational version is sent to Claude on the next parse
