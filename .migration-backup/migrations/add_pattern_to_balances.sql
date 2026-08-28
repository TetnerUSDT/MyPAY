-- Add pattern column to balances table
ALTER TABLE balances ADD COLUMN pattern TEXT DEFAULT NULL;

-- Add sample patterns for existing balances
UPDATE balances SET pattern = '^T[A-Za-z0-9]{33}$' WHERE title LIKE '%TRC20%' OR network = 'TRC20';
UPDATE balances SET pattern = '^0x[a-fA-F0-9]{40}$' WHERE title LIKE '%BEP20%' OR network = 'BEP20';
UPDATE balances SET pattern = '^(EQA|EQB|EQ[C-J])[A-Za-z0-9_-]{45}$' WHERE title LIKE '%TON%' OR network = 'TON';
