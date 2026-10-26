alter table public.chat_canva_links add column preview_url text;
update public.chat_canva_links set preview_url=url where url ~* '^https://(www\.)?canva\.com/design/' and preview_url is null;
update public.chat_canva_links c set preview_url=v.preview_url
from (values
 ('https://canva.link/vomvtwlr7n27gip','https://www.canva.com/design/DAHYD0KaHG4/K1JzZUKzFLpF5nnVEmieBg/edit'),
 ('https://canva.link/bujraiuimqka6f6','https://www.canva.com/design/DAHUnoAP0cY/iPL67rfiEvQLcDS4i-YHyg/edit'),
 ('https://canva.link/oghpvbcpjk6pj2p','https://www.canva.com/design/DAHX9Z1Kdgk/6EwvUOgi2PfvAEnxy8WY6A/edit'),
 ('https://canva.link/s0cl889baj8g3uf','https://www.canva.com/design/DAHXPWQCQrU/MjnT_4uZZfnvv3t3bGS69g/edit'),
 ('https://canva.link/invy97xkiukaidr','https://www.canva.com/design/DAHXGgnvqvs/GGK_e661QXUv2B8UbJluFA/edit'),
 ('https://canva.link/5vewoeql1jqb6vw','https://www.canva.com/design/DAHVu0ZIiAg/C5zGi045lUNk0qKVpwBitQ/edit'),
 ('https://canva.link/5y1urh9dt6pjfqz','https://www.canva.com/design/DAHV1dSy6l0/pHii5rZTAmHQmhff-xc02Q/edit'),
 ('https://canva.link/ly0zvp1m874f71n','https://www.canva.com/design/DAHVoWF9PNQ/fdZL5T0PjtaNOBlYoGQeNQ/edit'),
 ('https://canva.link/717g1lhb793nl46','https://www.canva.com/design/DAHUt6xP2xg/85xuo4crlLOJtDK3QhkgYA/edit'),
 ('https://canva.link/09jfw46bkl35rz0','https://www.canva.com/design/DAHUBiqfL3E/YsLgFdV77ryK2LvRrm6eEw/edit'),
 ('https://canva.link/top1n7cs7fqqsxl','https://www.canva.com/design/DAHUZc3Lp7Q/dw03DkXDKYy0QITlW3lI_Q/edit')
) as v(short_url,preview_url)
where c.normalized_url=v.short_url;
