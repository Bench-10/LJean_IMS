BEGIN;

ALTER TABLE User_Creation_Requests
    DROP CONSTRAINT IF EXISTS user_creation_requests_resolution_status_check;

ALTER TABLE User_Creation_Requests
    ADD CONSTRAINT user_creation_requests_resolution_status_check
    CHECK (resolution_status IN ('pending','approved','rejected','deleted','cancelled'));

COMMIT;
