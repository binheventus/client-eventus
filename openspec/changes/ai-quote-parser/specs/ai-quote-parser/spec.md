# Spec: ai-quote-parser

## ADDED Requirements

### Requirement: AI parser endpoint mode

`POST /api/parse-quote` SHALL accept an optional `mode` field in the request body. When `mode === 'ai'` and the server has a valid `ANTHROPIC_API_KEY`, the handler MUST attempt to parse the brief through Claude before returning. For any other value of `mode` (including missing), the handler MUST run the existing deterministic regex parser. The response schema (`{ parsed, missing_fields, ambiguous_fields, ai_reasoning, pricing_meta }`) MUST be identical between modes; only the value of a new `source` field differs.

#### Scenario: Request without mode field falls back to regex

- **WHEN** client sends `POST /api/parse-quote` with body `{ "input_text": "2 chụp 5 tiếng Hà Nội" }`
- **THEN** server returns the regex parser result with `source: 'regex'` and the response shape matches the existing schema

#### Scenario: Request with mode=ai and valid key calls Claude

- **WHEN** client sends `POST /api/parse-quote` with body `{ "input_text": "...", "mode": "ai" }` and the server has `ANTHROPIC_API_KEY` configured
- **THEN** server calls Claude API and returns the AI-parsed result with `source: 'ai'`

#### Scenario: Request with mode=ai but missing key falls back to regex

- **WHEN** client sends `POST /api/parse-quote` with body `{ "input_text": "...", "mode": "ai" }` and the server does NOT have `ANTHROPIC_API_KEY`
- **THEN** server runs regex parser and returns result with `source: 'ai_fallback'` and `ai_reasoning` containing a Vietnamese explanation that AI is unavailable

#### Scenario: Anthropic API error falls back to regex

- **WHEN** client sends a `mode: 'ai'` request and the Anthropic API responds with 5xx, times out, or returns an invalid tool call payload
- **THEN** server logs the warning, runs the regex parser, and returns `source: 'ai_fallback'` with the failure reason in `ai_reasoning`

### Requirement: AI parser probe endpoint

`GET /api/parse-quote?probe=1` SHALL return a JSON payload telling the client whether AI parsing is available. The endpoint MUST NOT call Anthropic; it only checks key presence.

#### Scenario: Probe returns ai_available=true when key configured

- **WHEN** client sends `GET /api/parse-quote?probe=1` and the server has `ANTHROPIC_API_KEY` set
- **THEN** server returns `{ "ai_available": true, "model": "<configured model>" }`

#### Scenario: Probe returns ai_available=false when key missing

- **WHEN** client sends `GET /api/parse-quote?probe=1` and the server does NOT have `ANTHROPIC_API_KEY`
- **THEN** server returns `{ "ai_available": false, "model": null }`

### Requirement: AI output respects in-chat pricing

When the user's chat explicitly mentions a price for any item, the AI parser MUST set `is_overridden: true`, `unit_price` to the price found in chat, and provide a Vietnamese `override_reason` referencing the chat. This applies whether the item is in the catalog or a custom item.

#### Scenario: Catalog service with overridden price

- **WHEN** chat says "2 chụp 1tr8/người, nội thành 4 tiếng" and the AI parses it
- **THEN** the resulting item has `service_code: 'CHUP_IN_4H'`, `quantity: 2`, `unit_price: 1800000`, `is_overridden: true`, `override_reason` containing "1tr8" or equivalent

#### Scenario: Custom item with chat price

- **WHEN** chat mentions "1 MC, báo riêng 5tr"
- **THEN** the resulting item has `is_custom: true`, `service_code: 'CUSTOM'`, `service_name` containing "MC", `unit_price: 5000000`, `is_overridden: true`, `group_code: 'OTHER'`

### Requirement: AI maps location and duration suffixes correctly

The AI parser MUST map services to the correct location/duration variant based on the brief: `_IN_4H` (Hà Nội + ≤4.5h), `_IN_8H` (Hà Nội + ≥7h), `_OUT_4H` (other locations + ≤4.5h), `_OUT_8H` (other locations + ≥7h). Services without those suffixes (RECAP_X_CAM, FPV_4H, etc.) keep their original code. When location is missing, default to "Hà Nội"; when duration is missing, default to 4 hours.

#### Scenario: Provincial event with full day uses _OUT_8H

- **WHEN** chat says "2 chụp 1 quay 8 tiếng Hải Phòng"
- **THEN** AI returns items `[CHUP_OUT_8H x2, QUAY_RECAP_OUT_8H x1]`, location `Hải Phòng`, duration_hours `8`

#### Scenario: Brief without location defaults to Hà Nội

- **WHEN** chat says "1 chụp 1 quay 4 tiếng" without naming a location
- **THEN** AI returns location `Hà Nội` and uses `_IN_4H` services

### Requirement: AI handles items outside catalog as custom items

When chat mentions services not in the pricing catalog (MC, LED background, decoration, gifts, etc.), the AI MUST return them with `is_custom: true`, `service_code: 'CUSTOM'`, `group_code: 'OTHER'`, `group_label: 'Chi phí khác'`, `service_name` taken from chat, and `unit_price` from chat (or `0` if not mentioned, with a note in `ai_reasoning` flagging it).

#### Scenario: Off-catalog MC with price

- **WHEN** chat mentions "1 MC bên em báo 5tr"
- **THEN** parsed result includes a custom item with `service_name: 'MC'` (or similar), `unit_price: 5000000`, `is_overridden: true`, `group_code: 'OTHER'`

#### Scenario: Off-catalog item without price flagged

- **WHEN** chat mentions "có thêm bóng bay trang trí" without a price
- **THEN** parsed result includes a custom item with `unit_price: 0` and `ai_reasoning` mentions sales should fill in the price

### Requirement: AI defers RECAP auto-add to business rules unless price specified

When the chat does NOT mention a price for editing/recap, the AI MUST NOT add a RECAP item — `applyBriefBusinessRules` will add the appropriate `RECAP_X_CAM` based on camera count using the catalog price. When the chat DOES mention a recap price, the AI MUST include the RECAP item with `is_overridden: true` and the chat price.

#### Scenario: Chat says "có dựng" without price → AI omits RECAP

- **WHEN** chat says "4 quay có dựng recap"
- **THEN** AI returns only `[QUAY_RECAP_X x4]`; no RECAP item; downstream `applyBriefBusinessRules` adds `RECAP_3_4_CAM` with the catalog price

#### Scenario: Chat specifies recap price → AI includes overridden RECAP

- **WHEN** chat says "4 quay có dựng recap 5tr"
- **THEN** AI returns `[QUAY_RECAP_X x4, RECAP_3_4_CAM x1]` where the RECAP item has `unit_price: 5000000` and `is_overridden: true`

### Requirement: AI auto-adds explicitly mentioned accessories

When the chat names an accessory whose service exists in the catalog (gimbal wireless, capture card, drone permit, 4G SIM, tech bridge, etc.), the AI MUST add the corresponding service item with quantity 1 (or the explicit number from chat). For vague mentions like "đầy đủ thiết bị", AI MUST NOT add anything — sales will add manually.

#### Scenario: Gimbal mentioned with quay live

- **WHEN** chat says "1 quay live 4h có gimbal wireless"
- **THEN** parsed items include `QUAY_LIVE_4H x1` and `GIMBAL_WIRELESS x1`

#### Scenario: Vague accessory phrase ignored

- **WHEN** chat says "team đầy đủ thiết bị"
- **THEN** AI does NOT add any unrequested accessory items

### Requirement: Business rules applied uniformly to AI and regex output

`applyBriefBusinessRules` (multi-day grouping, single-combo grouping, default RECAP auto-add) MUST run on both AI and regex parser outputs before returning to the client. The function is idempotent — when an AI output already includes a correct RECAP item, the rule does not duplicate it.

#### Scenario: AI returns 4 quay without recap, rule adds RECAP_3_4_CAM

- **WHEN** AI returns `[QUAY_RECAP_IN_4H x4]` and chat does not say "không dựng"
- **THEN** the final response items contain `[QUAY_RECAP_IN_4H x4, RECAP_3_4_CAM x1]` with the catalog price

#### Scenario: AI returns wrong RECAP bracket, rule replaces but keeps price override

- **WHEN** AI returns `[QUAY_RECAP_IN_4H x4, RECAP_1_2_CAM x1 with unit_price=5000000 is_overridden=true]`
- **THEN** the final items contain `RECAP_3_4_CAM x1` (replaced) with `unit_price=5000000` and `is_overridden=true` preserved

### Requirement: Frontend shows two analyze buttons with correct enable/disable state

`/quotes/new` SHALL render two buttons: "Phân tích nhanh" (regex, always enabled) and "Phân tích bằng AI" (AI mode, enabled only when probe returns `ai_available: true`). When AI is unavailable, the AI button MUST be disabled with a Vietnamese tooltip explaining why.

#### Scenario: Probe returns ai_available=true → AI button enabled

- **WHEN** the page mounts and probe response is `{ ai_available: true }`
- **THEN** both buttons are clickable; AI button shows the magic-wand icon and label "Phân tích bằng AI"

#### Scenario: Probe returns ai_available=false → AI button disabled

- **WHEN** the page mounts and probe response is `{ ai_available: false }`
- **THEN** the AI button is disabled with tooltip "Chưa cấu hình API key Claude"

### Requirement: Frontend cache differentiates by mode

The brief parser cache MUST include `mode` as part of the cache key so that switching between buttons does not return stale results from the other mode.

#### Scenario: User analyzes with AI then switches to regex

- **WHEN** user clicks AI, then edits the brief slightly, then clicks "Phân tích nhanh"
- **THEN** the regex result returns from a regex call (or its own cache), NOT from the AI cache entry

### Requirement: Frontend honors AI overrides during item normalization

When the AI returns an item with `is_overridden: true` and a positive `unit_price`, the frontend `normalizeParsedItem` MUST set the item's `unit_price` to that value, set `original_unit_price` to the catalog tier price, and preserve `is_overridden` plus `override_reason`. This ensures the existing override badge UI lights up.

#### Scenario: AI override flows through to display

- **WHEN** AI returns a CHUP_IN_4H item with `unit_price: 1800000, is_overridden: true, override_reason: 'Đã chốt với khách: 1tr8/người'`
- **THEN** the items table shows unit price `1.800.000đ`, the override indicator is visible, and the original tier price is preserved as `original_unit_price`

### Requirement: Anthropic prompt structured with cache_control

The Claude request MUST send the system prompt + catalog + foundational/custom examples as a single content block with `cache_control: { type: 'ephemeral' }`. The user's chat MUST be a separate uncached block. This MUST reduce the input token cost on cache hits compared to the no-cache baseline.

#### Scenario: Two AI parses within 5 minutes → second hits cache

- **WHEN** the same Eventus instance makes two AI parse requests within 5 minutes with identical system content
- **THEN** the second request reports cache hit metadata from Anthropic (cached input tokens > 0) in server logs
