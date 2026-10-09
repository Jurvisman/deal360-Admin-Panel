import { useState } from 'react';

const TIERS = [3, 6, 12];
const MODES = [
  { key: 'discount', label: 'Discount %' },
  { key: 'bonus', label: 'Bonus months' },
  { key: 'price', label: 'Fixed price' },
];

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const rupees = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`;

const fieldKey = (months, mode) =>
  mode === 'discount'
    ? `duration_${months}m_discount_percent`
    : mode === 'bonus'
      ? `duration_${months}m_bonus_months`
      : `duration_${months}m_price`;

// Which way a row is priced, read from the saved values (fixed price wins, then bonus).
const savedMode = (form, months) => {
  if (num(form[fieldKey(months, 'price')]) > 0) return 'price';
  if (num(form[fieldKey(months, 'bonus')]) > 0) return 'bonus';
  return 'discount';
};

/**
 * 3 / 6 / 12 month rows for duration pricing. Each row is priced ONE way:
 * a discount %, free bonus months, or a fixed total price for the whole duration.
 * Switching the way clears the other two fields so only one is ever saved.
 */
const DurationTierRows = ({ form, onChange, disabled }) => {
  const [picked, setPicked] = useState({});
  const monthlyPrice = num(form.price);

  const pickMode = (months, mode) => {
    setPicked((prev) => ({ ...prev, [months]: mode }));
    MODES.forEach(({ key }) => {
      if (key !== mode) onChange(fieldKey(months, key), key === 'price' ? '' : '0');
    });
  };

  return (
    <div className="duration-tier-rows" style={{ opacity: disabled ? 0.5 : 1 }}>
      {TIERS.map((months) => {
        const mode = picked[months] || savedMode(form, months);
        const key = fieldKey(months, mode);
        const value = form[key] ?? '';
        const listTotal = monthlyPrice * months;
        let pay = listTotal;
        let bonus = 0;
        if (mode === 'discount') pay = Math.round((listTotal * (100 - Math.min(100, num(value)))) / 100);
        if (mode === 'price' && num(value) > 0) pay = num(value);
        if (mode === 'bonus') bonus = num(value);
        const save = listTotal - pay;
        const tooHigh = mode === 'price' && num(value) > listTotal && listTotal > 0;

        return (
          <div key={months} className="duration-tier-row">
            <span className="duration-tier-months">{months} months</span>
            <div className="duration-tier-modes" role="radiogroup" aria-label={`${months} month pricing type`}>
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.key}
                  className={mode === m.key ? 'is-active' : ''}
                  onClick={() => pickMode(months, m.key)}
                  disabled={disabled}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="0"
              max={mode === 'discount' ? 100 : mode === 'bonus' ? 24 : undefined}
              value={value}
              onChange={(event) => onChange(key, event.target.value)}
              disabled={disabled}
              placeholder={mode === 'price' ? `e.g. ${Math.round(listTotal * 0.6) || 699}` : '0'}
              aria-label={`${months} month ${mode}`}
            />
            <span className="duration-tier-preview">
              {monthlyPrice > 0 ? (
                <>
                  {save > 0 && <s>{rupees(listTotal)}</s>} <b>{rupees(pay)}</b>
                  {bonus > 0 && ` + ${bonus} free month${bonus > 1 ? 's' : ''}`}
                  {save > 0 && (
                    <em>
                      Save {rupees(save)} ({Math.round((save / listTotal) * 100)}%)
                    </em>
                  )}
                  {tooHigh && <em className="is-error">More than the regular {rupees(listTotal)}</em>}
                </>
              ) : (
                'Enter the monthly price first'
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default DurationTierRows;
