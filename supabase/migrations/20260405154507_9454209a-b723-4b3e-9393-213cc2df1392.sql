
-- Add pin_changed flag to admin_pins
ALTER TABLE admin_pins ADD COLUMN pin_changed boolean DEFAULT false;

-- Create login_attempts table for rate limiting
CREATE TABLE login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
