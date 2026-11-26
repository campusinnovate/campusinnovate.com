/* Conversion destinations must be copied from real Google Ads actions. */
(function () {
  'use strict';
  const destinations = {
    whatsapp: 'AW-18473450758/iaLBCN-i35AdEIb66ehE',
    brief: '' // Pending: real "Kirim Brief" action label from the Ads account.
  };
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  const safe = value => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
  const reportedBriefs = new Set();
  function report(kind, placement, id) {
    if (!['io.campusinnovate.com', 'innovate-organizer-profile.innovatecampus.chatgpt.site'].includes(location.hostname)) return;
    const parameters = { event_source: kind === 'brief' ? 'brief_form' : 'whatsapp_button', button_location: safe(placement), transport_type: 'beacon' };
    if (id) parameters.transaction_id = id;
    window.gtag('event', kind === 'brief' ? 'brief_submit' : 'whatsapp_click', parameters);
    if (destinations[kind]) window.gtag('event', 'conversion', { ...parameters, send_to: destinations[kind] });
  }
  document.addEventListener('click', function (event) {
    const link = event.target.closest?.('a[href]');
    if (!link || link.dataset.conversionSource === 'brief') return;
    let url;
    try { url = new URL(link.href, location.href); } catch { return; }
    if (!['http:', 'https:'].includes(url.protocol) || !['wa.me', 'whatsapp.com', 'www.whatsapp.com', 'api.whatsapp.com', 'web.whatsapp.com'].includes(url.hostname)) return;
    report('whatsapp', link.dataset.trackingLocation || link.id || link.closest('[id]')?.id || 'page');
  }, true);
  window.IOTracking = Object.freeze({
    briefSaved(id) {
      if (!id || reportedBriefs.has(id)) return;
      reportedBriefs.add(id);
      report('brief', 'brief', id);
    }
  });
}());
