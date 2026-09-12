// Generic multi-item ("slide"/"card") editor driven by a block's itemFields schema (see
// itemListBlockSchemas.js) — replaces the old shared hand-written item-editor JSX in
// AppConfigPage.js, one block type at a time. Reuses the EXISTING state-mutation functions
// (addPhaseOneItem/updatePhaseOneItem/removePhaseOneItem/movePhaseOneItem/duplicatePhaseOneItem,
// the navigation-target helpers, the media library/upload handlers) via context rather than
// reimplementing them — this component only owns the JSX, not the state logic, which keeps the
// migration low-risk.

import SearchableSelect from './SearchableSelect';

function ImageField({ field, item, idx, context }) {
  const warningKey = context.getWarningKey ? context.getWarningKey(idx, field.name) : null;
  const warning = warningKey ? context.phaseOneImageWarnings?.[warningKey] : null;
  return (
    <label key={field.name} className="field">
      <span>{field.label}</span>
      <div className="inline-row">
        <input
          type="text"
          value={item[field.name] || ''}
          onChange={(event) => context.handlePhaseOneImageChange(idx, field.name, event.target.value)}
          placeholder={field.placeholder || 'https://cdn.example.com/item.jpg'}
        />
        <button
          type="button"
          className="ghost-btn small"
          onClick={() => context.handleBentoImageClick({ kind: 'sdui', index: idx, field: field.name })}
          disabled={context.isUploadingBentoImage}
        >
          {context.isUploadingBentoImage ? 'Uploading...' : 'Upload'}
        </button>
        <button
          type="button"
          className="ghost-btn small"
          onClick={() => context.openMediaPicker({ kind: 'sdui', index: idx, field: field.name })}
        >
          Library
        </button>
      </div>
      {warning ? <span className="field-warning">{warning}</span> : null}
    </label>
  );
}

// Replicates the old shared "rich destination picker" — lets the admin pick a tap target by
// type (Product / Business / Category / Collection / Campaign / External URL / Custom) with a
// search-and-select UI for Product and Business, instead of typing a raw deep link by hand.
function DestinationPickerField({ idx, item, context }) {
  const usesCtaDestination = Boolean(context.usesCtaDestination);
  const navigationTarget = context.parseNavigationTarget(
    usesCtaDestination ? item.ctaLink || item.deepLink || '' : item.deepLink || '',
    item.destinationType,
    item.destinationValue
  );
  const updateTarget = (type, value) =>
    usesCtaDestination
      ? context.updateItemCtaNavigationTarget(idx, type, value)
      : context.updateItemNavigationTarget(idx, type, value);
  const handleTypeChange = (type) =>
    usesCtaDestination
      ? context.handleHeroCtaNavigationTargetTypeChange(idx, type)
      : context.handleHeroNavigationTargetTypeChange(idx, type);

  const resolvedLinkLabel = usesCtaDestination ? 'Resolved CTA link' : 'Resolved link';

  return (
    <>
      <label className="field">
        <span>{usesCtaDestination ? 'CTA destination type' : 'Destination type'}</span>
        <select value={navigationTarget.type} onChange={(event) => handleTypeChange(event.target.value)}>
          {(context.NAVIGATION_TARGET_OPTIONS || []).map((option) => (
            <option key={`nav-target-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {navigationTarget.type === 'COLLECTION' ? (
        <label className="field field-span">
          <span>Collection</span>
          <SearchableSelect
            value={navigationTarget.value}
            onChange={(nextValue) => updateTarget('COLLECTION', nextValue)}
            options={context.productCollectionOptions || []}
            placeholder="Search collections..."
            isLoading={context.isLoadingProductCollections}
          />
          <p className="field-help">
            {context.isLoadingProductCollections
              ? 'Loading product collections...'
              : `${resolvedLinkLabel}: ${context.buildNavigationTargetLink('COLLECTION', navigationTarget.value) || '(empty)'}`}
          </p>
        </label>
      ) : null}

      {navigationTarget.type === 'PRODUCT' ? (
        <label className="field field-span">
          <span>Product</span>
          <SearchableSelect
            value={navigationTarget.value}
            onChange={(nextValue) => updateTarget('PRODUCT', nextValue)}
            options={(context.approvedDestinationProducts || []).map((product) => ({
              value: String(product?.id || ''),
              label: context.formatCleanDestinationProductLabel(product),
              searchText: context.getDestinationProductSearchText(product),
            }))}
            placeholder="Search product by name, id, brand, SKU..."
            isLoading={context.isLoadingDestinationProducts}
          />
          <p className="field-help">
            {context.isLoadingDestinationProducts
              ? 'Loading approved products...'
              : `${resolvedLinkLabel}: ${context.buildNavigationTargetLink('PRODUCT', navigationTarget.value) || '(empty)'}`}
          </p>
        </label>
      ) : null}

      {navigationTarget.type === 'CATEGORY' || navigationTarget.type === 'MAIN_CATEGORY_PRODUCTS' ? (
        <label className="field field-span">
          <span>{navigationTarget.type === 'MAIN_CATEGORY_PRODUCTS' ? 'Main category products' : 'Category page'}</span>
          <SearchableSelect
            value={navigationTarget.value}
            onChange={(nextValue) => updateTarget(navigationTarget.type, nextValue)}
            options={context.destinationMainCategoryOptions || []}
            placeholder="Search main categories..."
          />
          <p className="field-help">
            {resolvedLinkLabel}: {context.buildNavigationTargetLink(navigationTarget.type, navigationTarget.value) || '(empty)'}
          </p>
        </label>
      ) : null}

      {navigationTarget.type === 'CATEGORY_PRODUCTS' ? (
        <label className="field field-span">
          <span>Category ID</span>
          <input
            type="text"
            value={navigationTarget.value}
            onChange={(event) => updateTarget(navigationTarget.type, event.target.value)}
            placeholder={context.getNavigationTargetPlaceholder(navigationTarget.type)}
          />
          <p className="field-help">
            {resolvedLinkLabel}: {context.buildNavigationTargetLink(navigationTarget.type, navigationTarget.value) || '(empty)'}
          </p>
        </label>
      ) : null}

      {navigationTarget.type === 'BUSINESS_PRODUCTS' ? (
        <label className="field field-span">
          <span>Business</span>
          <SearchableSelect
            value={navigationTarget.value}
            onChange={(businessId) => context.updateItemBusinessProductsTarget(idx, businessId, usesCtaDestination)}
            options={(Array.isArray(context.businessDirectory) ? context.businessDirectory : []).map((business) => ({
              value: context.resolveBusinessDirectoryId(business),
              label: context.formatBusinessDestinationLabel(business),
              searchText: context.getBusinessSelectionSearchText(business),
            }))}
            placeholder="Search business by name, mobile, city..."
            isLoading={context.isLoadingBusinessDirectory}
            onOpen={context.loadBusinessDirectory}
          />
          <p className="field-help">
            {resolvedLinkLabel}:{' '}
            {item.deepLink || context.buildNavigationTargetLink('BUSINESS_PRODUCTS', navigationTarget.value) || '(empty)'}
          </p>
        </label>
      ) : null}

      {navigationTarget.type === 'CAMPAIGN' || navigationTarget.type === 'EXTERNAL_URL' || navigationTarget.type === 'CUSTOM' ? (
        <label className="field field-span">
          <span>
            {navigationTarget.type === 'CUSTOM'
              ? 'Deep link'
              : navigationTarget.type === 'EXTERNAL_URL'
                ? 'External URL'
                : 'Campaign slug'}
          </span>
          <input
            type="text"
            value={navigationTarget.value}
            onChange={(event) => updateTarget(navigationTarget.type, event.target.value)}
            placeholder={context.getNavigationTargetPlaceholder(navigationTarget.type)}
          />
          <p className="field-help">
            {resolvedLinkLabel}: {context.buildNavigationTargetLink(navigationTarget.type, navigationTarget.value) || '(empty)'}
          </p>
        </label>
      ) : null}
    </>
  );
}

function ItemField({ field, item, idx, sectionForm, context }) {
  if (field.showIf && !field.showIf(sectionForm)) return null;

  if (field.type === 'text') {
    const label = typeof field.label === 'function' ? field.label(idx) : field.label;
    const placeholder = typeof field.placeholder === 'function' ? field.placeholder(idx) : field.placeholder;
    return (
      <label key={field.name} className="field">
        <span>{label}</span>
        <input
          type="text"
          value={item[field.name] || ''}
          onChange={(event) => context.updatePhaseOneItem(idx, field.name, event.target.value)}
          placeholder={placeholder}
        />
      </label>
    );
  }

  if (field.type === 'color') {
    const label = typeof field.label === 'function' ? field.label(idx) : field.label;
    const fallback = typeof field.default === 'function' ? field.default(idx) : field.default;
    const placeholder = typeof field.placeholder === 'function' ? field.placeholder(idx) : field.placeholder || fallback;
    return (
      <label key={field.name} className="field">
        <span>{label}</span>
        <div className="inline-row">
          <input
            type="text"
            value={item[field.name] || ''}
            onChange={(event) => context.updatePhaseOneItem(idx, field.name, event.target.value)}
            placeholder={placeholder}
          />
          <input
            type="color"
            className="color-input"
            value={context.resolveHexColor(item[field.name], fallback)}
            onChange={(event) => context.updatePhaseOneItem(idx, field.name, event.target.value)}
          />
        </div>
      </label>
    );
  }

  if (field.type === 'image') {
    return <ImageField key={field.name} field={field} item={item} idx={idx} context={context} />;
  }

  if (field.type === 'destination-picker') {
    return <DestinationPickerField key={field.name} idx={idx} item={item} context={context} />;
  }

  if (field.type === 'deep-link') {
    const presetMatch = (context.ITEM_DEEP_LINK_PRESETS || []).find(
      (opt) => opt.value && (item.deepLink || '').toLowerCase().startsWith(opt.value.toLowerCase())
    );
    return (
      <label key={field.name} className="field">
        <span>{field.label}</span>
        <div className="inline-row">
          <select
            value={presetMatch?.value || ''}
            onChange={(event) => {
              const preset = (context.ITEM_DEEP_LINK_PRESETS || []).find((opt) => opt.value === event.target.value);
              context.updatePhaseOneItem(idx, 'deepLink', preset ? preset.value : item.deepLink || '');
            }}
          >
            <option value="">Custom</option>
            {(context.ITEM_DEEP_LINK_PRESETS || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={item.deepLink || ''}
            onChange={(event) => context.updatePhaseOneItem(idx, 'deepLink', event.target.value)}
            placeholder="app://category/electronics"
          />
        </div>
      </label>
    );
  }

  return null;
}

export function ItemListFieldEditor({ schema, sectionForm, context }) {
  const blockType = sectionForm.blockType || sectionForm.type || '';
  const items = context.normalizePhaseOneItems(sectionForm.sduiItems, blockType);
  const maxItems = schema.maxItems || Infinity;
  const canAddMore = items.length < maxItems;

  // Some blocks (e.g. Promo Hero Banner) can run off a live data-source feed instead of manual
  // items — in that mode the old JSX hides the item editor entirely and shows a note instead.
  if (context.isDataSourceFeedActive) {
    return (
      <label className="field field-span">
        <span>{schema.label || 'Items'}</span>
        <div className="field-help">
          {schema.feedActiveHelpText ||
            'This section is using a live data source feed. Manual item fields are hidden while feed mode is enabled.'}
        </div>
      </label>
    );
  }

  return (
    <label className="field field-span">
      <span>{schema.label || 'Items'}</span>
      {canAddMore ? (
        <div className="inline-row">
          <button type="button" className="ghost-btn small" onClick={context.addPhaseOneItem}>
            + Add item
          </button>
        </div>
      ) : null}
      <div className="field field-span phase-one-item-grid">
        {items.map((item, idx, allItems) => (
          <div key={`item-list-${idx}`} className="phase-one-item-card">
            <div className="phase-one-item-header">
              <div className="bento-tile-title">{schema.itemLabel ? schema.itemLabel(idx) : `Item ${idx + 1}`}</div>
              <div className="phase-one-item-actions">
                <button
                  type="button"
                  className="ghost-btn small phase-one-icon-btn"
                  title="Move up"
                  onClick={() => context.movePhaseOneItem(idx, -1)}
                  disabled={idx === 0}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="ghost-btn small phase-one-icon-btn"
                  title="Move down"
                  onClick={() => context.movePhaseOneItem(idx, 1)}
                  disabled={idx >= allItems.length - 1}
                >
                  Down
                </button>
                <button
                  type="button"
                  className="ghost-btn small"
                  onClick={() => context.duplicatePhaseOneItem(idx)}
                  disabled={!canAddMore}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="ghost-btn small danger"
                  onClick={() => context.removePhaseOneItem(idx)}
                >
                  Remove
                </button>
              </div>
            </div>
            {(schema.itemFields || []).map((field) => (
              <ItemField key={field.name} field={field} item={item} idx={idx} sectionForm={sectionForm} context={context} />
            ))}
          </div>
        ))}
      </div>
    </label>
  );
}
