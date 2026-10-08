-- Rename the existing Arctic Aircon branch records to the four user-requested
-- operating locations. Keep every branch ID so its technicians, bookings,
-- inventory, service requests, and audit history retain their ownership.
DO $$
DECLARE
  target_organization_count integer;
BEGIN
  SELECT COUNT(*) INTO target_organization_count
  FROM "Organization"
  WHERE "name" = 'Arctic Aircon';

  IF target_organization_count > 1 THEN
    RAISE EXCEPTION 'Expected at most one Arctic Aircon organization, found %', target_organization_count;
  END IF;

  IF target_organization_count = 1 THEN
    IF EXISTS (
      SELECT 1
      FROM (VALUES
        ('East Branch', 'Tampines / Changi'),
        ('North Branch', 'Yishun / Woodlands'),
        ('South Branch', 'Marina Bay / Sentosa'),
        ('West Branch', 'Jurong / Clementi')
      ) AS expected("name", "location")
      LEFT JOIN "Organization" AS organization
        ON organization."name" = 'Arctic Aircon'
      LEFT JOIN "Branch" AS branch
        ON branch."organizationId" = organization."id"
        AND branch."name" = expected."name"
        AND branch."location" = expected."location"
      GROUP BY expected."name", expected."location"
      HAVING COUNT(branch."id") <> 1
    ) THEN
      RAISE EXCEPTION 'Expected exactly one of each existing Arctic Aircon branch before renaming';
    END IF;
  END IF;
END;
$$;

UPDATE "Branch" AS branch
SET "name" = 'Makati Branch', "location" = 'Makati / BGC'
FROM "Organization" AS organization
WHERE branch."organizationId" = organization."id"
  AND organization."name" = 'Arctic Aircon'
  AND branch."name" = 'East Branch'
  AND branch."location" = 'Tampines / Changi';

UPDATE "Branch" AS branch
SET "name" = 'Quezon City Branch', "location" = 'Quezon City / Marikina'
FROM "Organization" AS organization
WHERE branch."organizationId" = organization."id"
  AND organization."name" = 'Arctic Aircon'
  AND branch."name" = 'North Branch'
  AND branch."location" = 'Yishun / Woodlands';

UPDATE "Branch" AS branch
SET "name" = 'Cavite Branch', "location" = 'Cavite'
FROM "Organization" AS organization
WHERE branch."organizationId" = organization."id"
  AND organization."name" = 'Arctic Aircon'
  AND branch."name" = 'South Branch'
  AND branch."location" = 'Marina Bay / Sentosa';

UPDATE "Branch" AS branch
SET "name" = 'Bulacan Branch', "location" = 'Bulacan'
FROM "Organization" AS organization
WHERE branch."organizationId" = organization."id"
  AND organization."name" = 'Arctic Aircon'
  AND branch."name" = 'West Branch'
  AND branch."location" = 'Jurong / Clementi';
