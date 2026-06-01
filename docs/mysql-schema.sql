create table if not exists client_customers (
  id varchar(64) primary key,
  name varchar(255) not null,
  phone varchar(60) null,
  email varchar(255) null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  unique key client_customers_name_unique (name)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_quotes (
  id varchar(32) primary key,
  quote_number varchar(40) null unique,
  ai_input text null,
  client_id varchar(64) null,
  client_name varchar(255) null,
  entity_code varchar(80) null,
  tier_code varchar(80) null,
  event_name varchar(255) null,
  event_date date null,
  location varchar(255) null,
  duration_hours decimal(10,2) null,
  validity_days int not null default 15,
  has_vat tinyint(1) not null default 1,
  show_stamp tinyint(1) not null default 1,
  terms_text longtext null,
  status varchar(40) not null default 'sent',
  sent_at datetime(3) null,
  subtotal decimal(18,2) not null default 0,
  travel_fee_total decimal(18,2) not null default 0,
  overtime_fee_total decimal(18,2) not null default 0,
  vat_amount decimal(18,2) not null default 0,
  total_amount decimal(18,2) not null default 0,
  share_token varchar(32) not null unique,
  created_by varchar(80) null,
  created_by_name varchar(255) null,
  sales_name varchar(255) null,
  deleted_at datetime(3) null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  key client_quotes_client_id_idx (client_id),
  key client_quotes_status_idx (status),
  key client_quotes_created_at_idx (created_at),
  key client_quotes_deleted_at_idx (deleted_at),
  key client_quotes_deleted_created_idx (deleted_at, created_at),
  key client_quotes_deleted_status_created_idx (deleted_at, status, created_at),
  key client_quotes_deleted_created_by_created_idx (deleted_at, created_by, created_at),
  key client_quotes_deleted_entity_created_idx (deleted_at, entity_code, created_at),
  key client_quotes_deleted_tier_created_idx (deleted_at, tier_code, created_at),
  constraint client_quotes_client_id_fk foreign key (client_id) references client_customers (id) on delete set null
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_quote_items (
  id varchar(64) primary key,
  quote_id varchar(32) not null,
  service_code varchar(120) null,
  service_name text null,
  service_name_raw text null,
  unit varchar(80) null,
  quantity decimal(12,2) not null default 1,
  num_sessions decimal(12,2) not null default 1,
  billable_duration_hours decimal(10,2) null,
  unit_price decimal(18,2) not null default 0,
  total_price decimal(18,2) not null default 0,
  is_custom tinyint(1) not null default 0,
  custom_sort_rank int null,
  is_overridden tinyint(1) not null default 0,
  original_unit_price decimal(18,2) null,
  override_reason text null,
  group_code varchar(80) null,
  group_label varchar(255) null,
  group_sort_order int null,
  sort_order int not null default 1,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  key client_quote_items_quote_id_idx (quote_id),
  constraint client_quote_items_quote_id_fk foreign key (quote_id) references client_quotes (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_quote_views (
  id varchar(64) primary key,
  quote_id varchar(32) not null,
  user_agent text null,
  viewed_at datetime(3) not null default current_timestamp(3),
  key client_quote_views_quote_id_idx (quote_id),
  constraint client_quote_views_quote_id_fk foreign key (quote_id) references client_quotes (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_quote_survey_responses (
  id varchar(64) primary key,
  quote_id varchar(32) not null,
  response_type varchar(60) not null,
  response_label varchar(255) not null,
  selected_tag text null,
  user_agent text null,
  created_at datetime(3) not null default current_timestamp(3),
  key client_quote_survey_responses_quote_created_idx (quote_id, created_at),
  key client_quote_survey_responses_type_idx (response_type),
  constraint client_quote_survey_responses_quote_id_fk foreign key (quote_id) references client_quotes (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_contract_templates (
  id varchar(120) primary key,
  name varchar(255) not null,
  description text null,
  title varchar(255) not null default 'HOP DONG CUNG CAP DICH VU',
  seller_entity_code varchar(80) null,
  party_role_config json not null,
  contract_number_pattern varchar(255) null,
  preamble json not null,
  service_scope text null,
  schedule_rows json not null,
  quote_table_config json not null,
  payment_config json not null,
  content_sections json not null,
  terms_text longtext not null,
  is_default tinyint(1) not null default 0,
  is_active tinyint(1) not null default 1,
  sort_order int not null default 100,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  key client_contract_templates_active_idx (is_active, sort_order)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_contracts (
  id varchar(64) primary key,
  quote_id varchar(32) null unique,
  quote_number varchar(40) null,
  source_type varchar(40) not null default 'quote',
  external_job_id bigint unsigned null,
  share_token varchar(32) null,
  contract_number varchar(120) not null,
  status varchar(40) not null default 'draft',
  template_id varchar(120) null,
  title varchar(255) not null default 'HOP DONG CUNG CAP DICH VU',
  seller_entity_code varchar(80) null,
  seller_snapshot json not null,
  customer_snapshot json not null,
  party_role_config json not null,
  contract_number_pattern varchar(255) null,
  preamble json not null,
  service_scope text null,
  schedule_rows json not null,
  quote_table_config json not null,
  payment_config json not null,
  content_sections json not null,
  terms_text longtext not null,
  quote_snapshot json not null,
  source_snapshot json null,
  deleted_at datetime(3) null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  key client_contracts_quote_id_idx (quote_id),
  key client_contracts_deleted_at_idx (deleted_at),
  key client_contracts_deleted_updated_idx (deleted_at, updated_at),
  unique key client_contracts_share_token_unique (share_token),
  unique key client_contracts_source_job_unique (source_type, external_job_id),
  constraint client_contracts_quote_id_fk foreign key (quote_id) references client_quotes (id) on delete set null
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_contract_document_templates (
  id varchar(120) primary key,
  document_type varchar(60) not null,
  name varchar(255) not null,
  description text null,
  title varchar(255) not null default '',
  seller_entity_code varchar(80) null,
  document_number_pattern varchar(255) null,
  fields_config json not null,
  numbering_config json not null,
  content_sections json not null,
  terms_text longtext null,
  is_default tinyint(1) not null default 0,
  sort_order int not null default 100,
  deleted_at datetime(3) null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  key client_contract_doc_templates_type_idx (document_type, sort_order),
  key client_contract_doc_templates_deleted_idx (deleted_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_contract_documents (
  id varchar(64) primary key,
  contract_id varchar(64) not null,
  document_type varchar(60) not null,
  document_number varchar(160) not null,
  document_number_pattern varchar(255) null,
  sequence_year int not null,
  sequence_number int not null,
  status varchar(40) not null default 'draft',
  template_id varchar(120) null,
  title varchar(255) not null default '',
  seller_entity_code varchar(80) not null,
  issued_date date null,
  finalized_at datetime(3) null,
  share_token varchar(32) not null,
  template_snapshot json not null,
  contract_snapshot json not null,
  document_data json not null,
  content_sections json not null,
  terms_text longtext null,
  auto_sync_contract tinyint(1) not null default 1,
  deleted_at datetime(3) null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  key client_contract_documents_contract_idx (contract_id, deleted_at, created_at),
  key client_contract_documents_type_idx (document_type, status, deleted_at),
  key client_contract_documents_sequence_idx (seller_entity_code, document_type, sequence_year, sequence_number),
  unique key client_contract_documents_share_unique (share_token),
  constraint client_contract_documents_contract_fk foreign key (contract_id) references client_contracts (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_contract_document_number_counters (
  id varchar(180) primary key,
  seller_entity_code varchar(80) not null,
  document_type varchar(60) not null,
  sequence_year int not null,
  last_sequence int not null default 0,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  unique key client_contract_doc_no_counters_scope_unique (seller_entity_code, document_type, sequence_year)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_contract_document_number_ledger (
  id varchar(64) primary key,
  document_id varchar(64) not null,
  seller_entity_code varchar(80) not null,
  document_type varchar(60) not null,
  sequence_year int not null,
  sequence_number int not null,
  document_number varchar(160) not null,
  created_at datetime(3) not null default current_timestamp(3),
  unique key client_contract_doc_no_ledger_scope_unique (seller_entity_code, document_type, sequence_year, sequence_number),
  unique key client_contract_doc_no_ledger_doc_unique (document_id),
  key client_contract_doc_no_ledger_number_idx (document_number)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_pages (
  id bigint unsigned primary key auto_increment,
  category varchar(120) not null,
  title varchar(255) not null,
  content longtext not null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  unique key client_pages_category_title_unique (category, title)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_feedbacks (
  id varchar(64) primary key,
  legacy_id bigint unsigned null,
  public_code varchar(4) null,
  job_id bigint unsigned not null,
  share_token varchar(40) not null,
  name varchar(255) null,
  status varchar(40) not null default 'open',
  video_url longtext null,
  video_title varchar(500) null,
  direct_video_url longtext null,
  drive_url longtext null,
  video_preview_url longtext null,
  audio_preview_url longtext null,
  overall_feedback json null,
  more_column tinyint(1) not null default 0,
  done_feedback tinyint(1) not null default 0,
  editor_employee_id bigint unsigned null,
  editor_name varchar(255) null,
  editor_phone varchar(80) null,
  update_preview_at datetime(3) null,
  started_at datetime(3) null,
  completed_at datetime(3) null,
  deleted_at datetime(3) null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  unique key client_feedbacks_legacy_unique (legacy_id),
  unique key client_feedbacks_public_code_unique (public_code),
  unique key client_feedbacks_share_token_unique (share_token),
  key client_feedbacks_job_idx (job_id, deleted_at, created_at),
  key client_feedbacks_status_idx (status, deleted_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_feedback_comments (
  id varchar(64) primary key,
  legacy_id bigint unsigned null,
  feedback_id varchar(64) not null,
  comment_1 longtext null,
  image_comment_1 longtext null,
  reply_1 longtext null,
  image_reply_1 longtext null,
  time_comment_1 decimal(12,3) null,
  time_reply_1 decimal(12,3) null,
  is_done_1 tinyint(1) not null default 0,
  comment_2 longtext null,
  image_comment_2 longtext null,
  reply_2 longtext null,
  image_reply_2 longtext null,
  time_comment_2 decimal(12,3) null,
  time_reply_2 decimal(12,3) null,
  is_done_2 tinyint(1) not null default 0,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  unique key client_feedback_comments_legacy_unique (legacy_id),
  key client_feedback_comments_feedback_idx (feedback_id, created_at),
  constraint client_feedback_comments_feedback_fk foreign key (feedback_id) references client_feedbacks (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_feedback_attachments (
  id varchar(64) primary key,
  legacy_id bigint unsigned null,
  comment_id varchar(64) not null,
  file_name varchar(500) not null,
  url longtext not null,
  storage_path longtext null,
  preview_url longtext null,
  field_name varchar(80) null,
  file_type varchar(40) not null default 'file',
  delete_at datetime(3) null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  unique key client_feedback_attachments_legacy_unique (legacy_id),
  key client_feedback_attachments_comment_idx (comment_id, created_at),
  constraint client_feedback_attachments_comment_fk foreign key (comment_id) references client_feedback_comments (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_feedback_survey_questions (
  id varchar(64) primary key,
  legacy_id bigint unsigned null,
  question text not null,
  type varchar(40) not null default 'video',
  star int null,
  text_left varchar(255) null,
  text_right varchar(255) null,
  is_active tinyint(1) not null default 1,
  sort_order int not null default 100,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  unique key client_feedback_survey_questions_legacy_unique (legacy_id),
  key client_feedback_survey_questions_type_idx (type, is_active, sort_order)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_feedback_survey_answers (
  id varchar(64) primary key,
  legacy_id bigint unsigned null,
  question_id varchar(64) not null,
  answer varchar(500) not null,
  is_star tinyint(1) not null default 0,
  sort_order int not null default 100,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  unique key client_feedback_survey_answers_legacy_unique (legacy_id),
  key client_feedback_survey_answers_question_idx (question_id, sort_order),
  constraint client_feedback_survey_answers_question_fk foreign key (question_id) references client_feedback_survey_questions (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_feedback_survey_responses (
  id varchar(64) primary key,
  job_id bigint unsigned not null,
  feedback_id varchar(64) null,
  survey_type varchar(40) not null default 'video',
  respondent_name varchar(255) null,
  user_agent text null,
  created_at datetime(3) not null default current_timestamp(3),
  unique key client_feedback_survey_responses_job_type_unique (job_id, survey_type),
  key client_feedback_survey_responses_job_idx (job_id, created_at),
  key client_feedback_survey_responses_feedback_idx (feedback_id, created_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists client_feedback_survey_response_answers (
  id varchar(64) primary key,
  response_id varchar(64) not null,
  question_id varchar(64) not null,
  answer_id varchar(64) null,
  answer_text text null,
  created_at datetime(3) not null default current_timestamp(3),
  key client_feedback_survey_response_answers_response_idx (response_id),
  key client_feedback_survey_response_answers_question_idx (question_id),
  constraint client_feedback_survey_response_answers_response_fk foreign key (response_id) references client_feedback_survey_responses (id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
