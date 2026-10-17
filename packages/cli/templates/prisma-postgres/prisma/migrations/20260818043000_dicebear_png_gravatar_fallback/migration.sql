-- Gravatar rejects SVG default images (Error 0004); DiceBear fallbacks must use PNG.
UPDATE "user"
SET "image" = REPLACE("image", '%2Fsvg%3F', '%2Fpng%3F')
WHERE "image" LIKE '%dicebear.com%'
  AND "image" LIKE '%2Fsvg%3F%';
