# Database Update Instructions

## Adding Trust and Phone Fields to Users Table

The application schema has been updated to include two new fields in the `users` table:
- `trust` (INT, default 0) - Trust rating for the user
- `phone` (VARCHAR(20)) - User's phone number

### Manual MySQL Update Required

Since the project uses MySQL and drizzle.config.ts is configured for PostgreSQL, you need to manually add these fields to your MySQL database.

### SQL Migration Query

Run the following SQL query in your MySQL database:

```sql
ALTER TABLE users 
ADD COLUMN trust INT DEFAULT 0,
ADD COLUMN phone VARCHAR(20);
```

### How to Execute the Query

#### Option 1: Using MySQL Command Line
```bash
mysql -u your_username -p your_database_name
# Enter your password
# Then run:
ALTER TABLE users ADD COLUMN trust INT DEFAULT 0, ADD COLUMN phone VARCHAR(20);
```

#### Option 2: Using phpMyAdmin
1. Open phpMyAdmin
2. Select your database
3. Click on "SQL" tab
4. Paste the ALTER TABLE query
5. Click "Go"

#### Option 3: Using MySQL Workbench
1. Open MySQL Workbench
2. Connect to your database
3. Open a new SQL tab
4. Paste the ALTER TABLE query
5. Execute the query

### Verification

After running the query, verify the fields were added:

```sql
DESCRIBE users;
```

You should see `trust` and `phone` columns in the output.

### Important Notes

- The `trust` field defaults to 0 for all existing and new users
- The `phone` field is nullable and will be NULL for existing users
- These fields are already integrated into the application code and will work immediately after the database update
