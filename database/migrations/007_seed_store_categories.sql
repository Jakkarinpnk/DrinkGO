SET NAMES utf8mb4;

INSERT INTO store_categories (name, slug)
SELECT 'บาร์', 'bar' WHERE NOT EXISTS (SELECT 1 FROM store_categories WHERE name = 'บาร์' OR slug = 'bar');
INSERT INTO store_categories (name, slug)
SELECT 'ผับ', 'pub' WHERE NOT EXISTS (SELECT 1 FROM store_categories WHERE name = 'ผับ' OR slug = 'pub');
INSERT INTO store_categories (name, slug)
SELECT 'ร้านอาหาร', 'restaurant' WHERE NOT EXISTS (SELECT 1 FROM store_categories WHERE name = 'ร้านอาหาร' OR slug = 'restaurant');
INSERT INTO store_categories (name, slug)
SELECT 'คาเฟ่', 'cafe' WHERE NOT EXISTS (SELECT 1 FROM store_categories WHERE name = 'คาเฟ่' OR slug = 'cafe');
INSERT INTO store_categories (name, slug)
SELECT 'อื่น ๆ', 'other' WHERE NOT EXISTS (SELECT 1 FROM store_categories WHERE name = 'อื่น ๆ' OR slug = 'other');
