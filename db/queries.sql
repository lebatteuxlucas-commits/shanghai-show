-- Requêtes utiles, à coller dans l'éditeur SQL de Neon.

-- Demandes à traiter, les plus anciennes d'abord.
select id, created_at, email, company, name, supplier_name, hall, booth, files, message
from catalogue_requests
where status = 'new'
order by created_at;

-- Marquer une demande comme traitée (catalogue envoyé).
update catalogue_requests set status = 'sent', processed_at = now() where id = 42;

-- Fournisseurs dont les catalogues sont les plus demandés.
select supplier_name, count(*) as requests, count(distinct email) as requesters
from catalogue_requests
group by supplier_name
order by requests desc
limit 30;

-- Retrait des données d'un demandeur (RGPD).
delete from catalogue_requests where email = 'someone@company.com';
