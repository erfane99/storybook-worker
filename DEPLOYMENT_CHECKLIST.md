# Environmental Validation Deployment Checklist

## Pre-Deployment Verification ✅

- [x] Database migration created
- [x] Validator class implemented and tested
- [x] Interfaces exported to service contracts
- [x] Database storage methods added
- [x] TypeScript build passes successfully
- [x] Documentation complete

## Deployment Steps

### 1. Database Migration (5 minutes)

**File:** `supabase/migrations/20251115132121_environmental_validation_results.sql`

**Option A: Supabase Dashboard**
```
1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy entire contents of migration file
4. Click "Run"
5. Verify success message
```

**Option B: Supabase CLI**
```bash
supabase db push
```

**Verification:**
```sql
-- Check table exists
SELECT * FROM environmental_validation_results LIMIT 1;

-- Should return: no rows (table is empty but exists)
```

- [ ] Migration applied successfully
- [ ] Table exists in database
- [ ] Indexes created

---

### 2. Code Integration (15-30 minutes)

**File to Modify:** `src/lib/background-jobs/job-processor.ts`

**Step 2.1: Add Imports**

Location: Top of file (after existing imports)

```typescript
// Environmental Validation System
import {
  EnvironmentalConsistencyValidator,
  EnvironmentalValidationError
} from '../../services/ai/modular/environmental-consistency-validator.js';
import { OpenAIIntegration } from '../../services/ai/modular/openai-integration.js';
import { ErrorHandlingSystem } from '../../services/ai/modular/error-handling-system.js';
```

- [ ] Imports added

**Step 2.2: Initialize Validator**

Location: In `processStorybookJobWithServices()`, after line ~600 (after getting services)

```typescript
// Initialize Environmental Validator
const openaiIntegration = new OpenAIIntegration(
  process.env.OPENAI_API_KEY || '',
  new ErrorHandlingSystem('JobProcessor')
);

const environmentalValidator = new EnvironmentalConsistencyValidator(
  openaiIntegration,
  databaseService
);
```

- [ ] Validator initialized

**Step 2.3: Add Validation Loop**

Location: After PHASE 6 (line ~890), before PHASE 7 (saving results)

See: `ENVIRONMENTAL_VALIDATION_INTEGRATION.md` lines 64-286 for complete code

Key sections:
- [ ] PHASE 6.5 header and progress update
- [ ] Page validation loop
- [ ] Try-catch with EnvironmentalValidationError handling
- [ ] Database storage calls
- [ ] Regeneration logic
- [ ] Enhanced prompt building
- [ ] Progress updates

**Step 2.4: Add Helper Method**

Location: End of `ProductionJobProcessor` class (before closing brace)

See: `ENVIRONMENTAL_VALIDATION_INTEGRATION.md` lines 288-350 for complete code

- [ ] Helper method added: `buildEnhancedEnvironmentalPrompts()`

**Step 2.5: Build and Verify**

```bash
npm run build
```

- [ ] Build passes
- [ ] No TypeScript errors
- [ ] No import errors

---

### 3. Testing (15-30 minutes)

**Test Case 1: Happy Path (All Pages Pass)**

1. Create a test storybook job
2. Monitor console for validation logs
3. Expected output:
   ```
   🌍 PHASE 6.5: Environmental Consistency Validation...
   📄 Validating page 1 (4 panels)...
   ✅ Environmental coherence: 87.5% - PASSED
   ```
4. Check database:
   ```sql
   SELECT * FROM environmental_validation_results
   WHERE job_id = 'YOUR_JOB_ID'
   ORDER BY page_number;
   ```
5. Expected: 1 record per page, all with `passes_threshold = true`

- [ ] Test completed successfully
- [ ] Console logs show validation
- [ ] Database records created
- [ ] Job completes successfully

**Test Case 2: Regeneration (Some Pages Fail First Attempt)**

This may happen naturally or can be tested with intentionally inconsistent environmental DNA.

Expected flow:
```
📄 Validating page 2 (4 panels)...
❌ Environmental coherence: 82.3% - FAILED
🔄 Regenerating entire page 2...
🌍 Validating environmental consistency: Page 2 (4 panels, attempt 2/2)
✅ Environmental coherence: 88.2% - PASSED
```

Database should show:
- 2 records for page 2
- First: `attempt_number=1`, `passes_threshold=false`, `regeneration_triggered=true`
- Second: `attempt_number=2`, `passes_threshold=true`

- [ ] Regeneration logic works
- [ ] Enhanced prompts applied
- [ ] Revalidation succeeds
- [ ] Database tracks both attempts

**Test Case 3: Graceful Degradation (Vision API Down)**

To test: Temporarily set invalid OPENAI_API_KEY

Expected:
```
⚠️ GPT-4 Vision API unavailable for page 1, marking as unvalidated
```

Job should:
- Continue without failing
- Complete successfully
- Log warning

- [ ] Job continues on API failure
- [ ] Warning logged
- [ ] No validation records created
- [ ] Job completes successfully

---

### 4. Monitoring Setup (10 minutes)

**Create Monitoring Queries**

Save these in your database monitoring tool:

**Query 1: Recent Validations**
```sql
SELECT
  job_id,
  page_number,
  overall_coherence,
  passes_threshold,
  attempt_number,
  validation_timestamp
FROM environmental_validation_results
ORDER BY validation_timestamp DESC
LIMIT 20;
```

**Query 2: Validation Statistics**
```sql
SELECT
  COUNT(*) as total_validations,
  COUNT(*) FILTER (WHERE passes_threshold = true) as passed,
  COUNT(*) FILTER (WHERE passes_threshold = false) as failed,
  ROUND(AVG(overall_coherence), 2) as avg_coherence,
  ROUND(AVG(attempt_number), 2) as avg_attempts,
  COUNT(*) FILTER (WHERE attempt_number = 2) as regenerated_pages
FROM environmental_validation_results
WHERE validation_timestamp > NOW() - INTERVAL '7 days';
```

**Query 3: Failure Analysis**
```sql
SELECT
  jsonb_array_elements_text(failure_reasons) as failure_reason,
  COUNT(*) as occurrences
FROM environmental_validation_results
WHERE passes_threshold = false
  AND validation_timestamp > NOW() - INTERVAL '7 days'
GROUP BY failure_reason
ORDER BY occurrences DESC
LIMIT 10;
```

**Query 4: Job Validation Summary**
```sql
SELECT
  job_id,
  COUNT(*) as total_pages,
  AVG(overall_coherence) as avg_coherence,
  MIN(overall_coherence) as min_coherence,
  MAX(overall_coherence) as max_coherence,
  COUNT(*) FILTER (WHERE attempt_number = 2) as regenerated_pages,
  BOOL_AND(passes_threshold) as all_passed
FROM environmental_validation_results
GROUP BY job_id
ORDER BY MAX(validation_timestamp) DESC
LIMIT 20;
```

- [ ] Monitoring queries created
- [ ] Queries tested
- [ ] Dashboard/alerts configured

---

### 5. Production Deployment (5 minutes)

**Deploy Backend Worker**

```bash
# Build
npm run build

# Deploy (your deployment method)
# Example for Railway:
railway up

# Example for Docker:
docker build -t storybook-worker .
docker push your-registry/storybook-worker
docker service update --image your-registry/storybook-worker your-service
```

- [ ] Build successful
- [ ] Worker deployed
- [ ] Service restarted
- [ ] Health check passing

---

## Post-Deployment Verification (30 minutes)

### Monitor First Jobs

Watch the first 5-10 jobs after deployment:

**Checklist per Job:**
- [ ] Job starts successfully
- [ ] PHASE 6.5 executes
- [ ] Validation logs appear
- [ ] Database records created
- [ ] Job completes (or fails appropriately)

**Success Metrics to Track:**

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Validation pass rate (1st attempt) | >80% | ___ % | ⬜ |
| Average coherence score | >88% | ___ % | ⬜ |
| Regeneration rate | <20% | ___ % | ⬜ |
| Job failure rate | <5% | ___ % | ⬜ |
| API availability | >99% | ___ % | ⬜ |

**Alert Thresholds:**

- ⚠️ **Warning:** Pass rate <80%, Avg coherence <85%, Regeneration rate >30%
- 🚨 **Critical:** Pass rate <60%, Avg coherence <80%, API availability <95%

---

## Rollback Plan (if needed)

If serious issues occur:

### Quick Rollback

1. Remove validation loop from job-processor.ts
2. Rebuild and redeploy
3. System reverts to pre-validation behavior

**Code to Remove:**
- PHASE 6.5 section (lines ~890-1100 after integration)
- Validator initialization
- Helper method
- Imports

### Database Rollback

Not required - table can remain. It will simply stop receiving new records.

Optional cleanup:
```sql
DROP TABLE IF EXISTS environmental_validation_results CASCADE;
```

---

## Cost Monitoring

**Expected Costs:**
- Per page validation: $0.02-0.04
- Per 4-page comic: $0.08-0.16 (first pass)
- With regeneration: +$0.02-0.04 per regenerated page

**Cost Tracking Query:**
```sql
SELECT
  DATE(validation_timestamp) as date,
  COUNT(*) as total_validations,
  COUNT(*) * 0.03 as estimated_cost_usd
FROM environmental_validation_results
WHERE validation_timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(validation_timestamp)
ORDER BY date DESC;
```

- [ ] Cost tracking query created
- [ ] Baseline cost established
- [ ] Budget alerts configured

---

## Support Resources

**Documentation:**
- Quick Start: `QUICK_START_ENVIRONMENTAL_VALIDATION.md`
- Integration Guide: `ENVIRONMENTAL_VALIDATION_INTEGRATION.md`
- Full Summary: `ENVIRONMENTAL_VALIDATION_SUMMARY.md`

**Database:**
- Migration: `supabase/migrations/20251115132121_environmental_validation_results.sql`

**Code:**
- Validator: `src/services/ai/modular/environmental-consistency-validator.ts`
- Interface: `src/services/interfaces/service-contracts.ts` (EnvironmentalConsistencyReport)
- Database: `src/services/database/database-service.ts` (storeEnvironmentalValidation)

**Troubleshooting:**

| Issue | Solution |
|-------|----------|
| Build fails | Check imports use `.js` extension |
| Validation always fails | Verify OPENAI_API_KEY, check threshold |
| Database errors | Verify migration applied, check RLS policies |
| High cost | Check regeneration rate, optimize threshold |
| Low pass rate | Review failure reasons, adjust environmental DNA |

---

## Sign-Off

### Development Team
- [ ] Code reviewed
- [ ] Tests passed
- [ ] Documentation complete
- [ ] Build verified

**Developer:** _________________ **Date:** _________

### QA Team
- [ ] Integration tested
- [ ] Edge cases tested
- [ ] Performance verified
- [ ] Regression tests passed

**QA Lead:** _________________ **Date:** _________

### DevOps Team
- [ ] Migration applied
- [ ] Deployment successful
- [ ] Monitoring configured
- [ ] Alerts set up

**DevOps Lead:** _________________ **Date:** _________

### Product Owner
- [ ] Feature meets requirements
- [ ] Quality standards verified
- [ ] Cost acceptable
- [ ] Ready for production

**Product Owner:** _________________ **Date:** _________

---

## Final Status

**Deployment Date:** _________________

**Status:** ⬜ Deployed Successfully | ⬜ Rolled Back | ⬜ In Progress

**Notes:**
_________________________________________
_________________________________________
_________________________________________

---

**Version:** 1.0.0
**Last Updated:** 2025-11-15
**System:** Environmental Consistency Validation
