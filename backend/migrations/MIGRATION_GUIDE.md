# Database Migration Guide

## Prerequisites
- PostgreSQL installed and running
- Database backup completed
- Access to psql command line or pgAdmin

## Step-by-Step Migration

### Option 1: Using psql Command Line (Recommended)

```powershell
# 1. Navigate to migrations folder
cd backend\migrations

# 2. Backup your database first!
pg_dump -U your_username -d your_database > backup_before_fractional.sql

# 3. Run each migration step in order
psql -U your_username -d your_database -f step1_create_unit_conversion.sql
psql -U your_username -d your_database -f step2_update_inventory_product.sql
psql -U your_username -d your_database -f step3_update_add_stocks.sql
psql -U your_username -d your_database -f step4_update_sales_items.sql
psql -U your_username -d your_database -f step5_update_sales_stock_usage.sql

# 4. Verify the migration
psql -U your_username -d your_database -f verify_migration.sql
```

### Option 2: Using pgAdmin

1. **Backup Database**
   - Right-click your database → Backup
   - Save the backup file

2. **Run Migrations**
   - Open Query Tool
   - Open and execute each SQL file in order:
     1. step1_create_unit_conversion.sql
     2. step2_update_inventory_product.sql
     3. step3_update_add_stocks.sql
     4. step4_update_sales_items.sql
     5. step5_update_sales_stock_usage.sql

3. **Verify**
   - Run verify_migration.sql
   - Check that all counts match expected values

## Troubleshooting

### If a step fails:

1. **Don't panic!** You have a backup.

2. **Check the error message**
   - If it's "column already exists" → Skip that step, it's already done
   - If it's "relation not found" → Check your table names
   - If it's "permission denied" → Check your user permissions

3. **Rollback if needed**
   ```powershell
   psql -U your_username -d your_database < backup_before_fractional.sql
   ```

4. **Fix and retry**
   - Address the error
   - Run the failed step again

## Verification Checklist

After migration, verify:

- [ ] Unit_Conversion table has 16 rows
- [ ] All Inventory_Product rows have base_unit and conversion_factor
- [ ] All Add_Stocks rows have quantity_added_base and quantity_left_base
- [ ] All Sales_Items rows have quantity_base
- [ ] All Sales_Stock_Usage rows have quantity_used_base
- [ ] Backend server starts without errors
- [ ] You can add items with fractional quantities
- [ ] You can sell items with fractional quantities

## Next Steps

After successful migration:

1. **Restart your backend server**
   ```powershell
   cd backend
   npm start
   ```

2. **Check server logs**
   - Look for: "✓ Unit conversion cache loaded: 16 units"
   - Look for: "✓ Unit conversion system initialized"

3. **Test the system**
   - Try adding 1.5 kg of a product
   - Try selling 0.5 kg
   - Verify displays show correct decimal places

4. **Monitor for issues**
   - Check for any errors in browser console
   - Check backend logs for any issues
   - Test all existing functionality still works

## If You Need to Rollback

```powershell
# Restore from backup
psql -U your_username -d your_database < backup_before_fractional.sql

# The system will work with integers again
```

## Getting Help

If you encounter issues:
1. Check the error message carefully
2. Review the migration SQL files
3. Check that all prerequisites are met
4. Verify database permissions
5. Check PostgreSQL version compatibility (9.5+)

## Migration Time Estimate

- Small database (< 1000 products): 1-2 minutes
- Medium database (1000-10000 products): 2-5 minutes
- Large database (> 10000 products): 5-15 minutes

Each step should complete within seconds unless you have a very large database.
