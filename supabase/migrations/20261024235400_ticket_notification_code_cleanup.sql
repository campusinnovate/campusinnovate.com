-- Keep historical notifications consistent with the current ticket codes.
update public.notifications
set title=replace(replace(title,'CI-TKT-2026-000009','CI-TKT-2026-000020'),'CI-TKT-2026-000010','CI-TKT-2026-000021'),
    message=replace(replace(message,'CI-TKT-2026-000009','CI-TKT-2026-000020'),'CI-TKT-2026-000010','CI-TKT-2026-000021')
where title like '%CI-TKT-2026-000009%' or title like '%CI-TKT-2026-000010%'
   or message like '%CI-TKT-2026-000009%' or message like '%CI-TKT-2026-000010%';