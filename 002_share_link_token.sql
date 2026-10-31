-- Paylaşım bağlantısının yöneticiler tarafından yeniden görüntülenebilmesi için şifreli kopya (AES-256-GCM).
alter table share_links add column token_enc text;
