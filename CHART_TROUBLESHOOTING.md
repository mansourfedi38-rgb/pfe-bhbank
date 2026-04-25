# Chart Loading Issue - Troubleshooting Guide

## 🔍 Current Situation

The charts are still stuck on "Loading charts..." even after fixes.

## 🛠️ Fix Applied: ChangeDetectorRef

I've added `ChangeDetectorRef` to force Angular to detect changes when chart data is updated. This is often the issue with Chart.js in Angular.

## 📋 Steps to Verify the Fix

### 1. Hard Refresh Your Browser

**Important:** The Angular dev server needs to recompile with the new changes.

- Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
- OR clear browser cache and refresh
- OR close browser completely and reopen `http://localhost:4200`

### 2. Open Browser DevTools Console

Press `F12` and go to the **Console** tab.

### 3. Navigate to Dashboard

Click on the Dashboard link in the navigation.

### 4. Check Console Output

You should see these logs:

```
Processing chart data, rows: X
Agency energy data: [['Agency 1', 4.5], ['Agency 2', 6.2], ...]
Date energy data: [{date: '2026-04-25', energy: 5.3}, ...]
Chart data processed, loading: false empty: false
```

**If you DON'T see these logs:**
- The API call is failing
- Check the Network tab for errors

### 5. Check Network Tab

In DevTools, go to the **Network** tab and look for:

- Request: `/api/kpis/energy/daily/`
- Status: Should be `200 OK`
- Response: Should be an array like:
  ```json
  [
    {"agency": 1, "agency_name": "Agency 1", "date": "2026-04-25", "total_energy": 1.5},
    {"agency": 2, "agency_name": "Agency 2", "date": "2026-04-25", "total_energy": 2.3}
  ]
  ```

**If status is NOT 200:**
- Backend might not be running
- Check terminal where you ran `py manage.py runserver`

### 6. Verify Charts Display

After the console logs appear, scroll down past the KPI table. You should see:

- **Bar Chart**: "Energy Consumption by Agency"
- **Line Chart**: "Energy Consumption Over Time"

---

## 🐛 If Charts Still Don't Show

### Common Issues & Solutions

#### Issue 1: Angular Didn't Recompile
**Solution:** 
```bash
# Stop the dev server (Ctrl+C)
# Then restart it:
cd c:\Users\pc\Desktop\pfe-bhbank\frontend\bh-bank-energy-ui
npm start
```

#### Issue 2: Backend Not Running
**Solution:**
```bash
cd c:\Users\pc\Desktop\pfe-bhbank\backend
py manage.py runserver
```

#### Issue 3: No Data in Database
**Solution:** Run the simulator:
```bash
cd c:\Users\pc\Desktop\pfe-bhbank\backend
py simulator.py
```
Wait 5 seconds for it to send data, then refresh the dashboard.

#### Issue 4: Browser Cache
**Solution:**
- Open DevTools (F12)
- Right-click the refresh button
- Select "Empty Cache and Hard Reload"

#### Issue 5: Chart.js Not Loaded
**Check:** In console, type:
```javascript
Chart
```
Should return the Chart.js object, not `undefined`.

If undefined, reinstall:
```bash
cd c:\Users\pc\Desktop\pfe-bhbank\frontend\bh-bank-energy-ui
npm install chart.js ng2-charts
```

---

## 🔧 Debug Mode

If still not working, add this temporary debug code to see what's happening:

**In dashboard.html, add this at the top of the charts section:**

```html
<!-- DEBUG INFO -->
<div style="background: yellow; padding: 10px; margin: 10px 0;">
  <p><strong>DEBUG:</strong></p>
  <p>chartsLoading: {{ chartsLoading }}</p>
  <p>chartsEmpty: {{ chartsEmpty }}</p>
  <p>chartError: {{ chartError }}</p>
  <p>dailyKpiRows.length: {{ dailyKpiRows.length }}</p>
  <p>energyByAgencyData.labels: {{ energyByAgencyData.labels | json }}</p>
  <p>energyByAgencyData.data: {{ energyByAgencyData.datasets[0].data | json }}</p>
</div>
```

This will show you the exact state of all variables. Share a screenshot of this if you need more help.

---

## ✅ Expected Final State

After the fix works correctly:

1. **Console shows:**
   ```
   Processing chart data, rows: 6
   Agency energy data: [['Agency 1', 4.5], ...]
   Date energy data: [{date: '2026-04-25', energy: 5.3}, ...]
   Chart data processed, loading: false empty: false
   ```

2. **Network tab shows:**
   - `/api/kpis/energy/daily/` → 200 OK

3. **Dashboard displays:**
   - Metric cards (top)
   - KPI table (middle)
   - Bar chart (bottom left) ✅
   - Line chart (bottom right) ✅

---

## 📝 What Changed in the Fix

**Added ChangeDetectorRef:**
```typescript
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';

constructor(
  private router: Router,
  private api: ApiService,
  private translate: TranslateService,
  private cdr: ChangeDetectorRef  // ← NEW
) {}

private processChartData(dailyKpi: DailyEnergyKpi[]): void {
  // ... process data ...
  
  // Force Angular to update the view
  this.cdr.detectChanges();
}
```

**Why this fixes the issue:**
- Chart.js updates happen outside Angular's zone
- Angular doesn't know the data changed
- `detectChanges()` forces Angular to check for updates
- The `*ngIf` conditions re-evaluate
- Charts render!

---

## 🆘 Still Not Working?

Please provide:
1. Screenshot of browser console (F12 → Console tab)
2. Screenshot of Network tab showing `/api/kpis/energy/daily/` request
3. Screenshot of the DEBUG section (if you added it)
4. Any error messages you see

This will help identify the exact issue.
