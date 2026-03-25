-- ROP Core Schema (Provided)
-- DO NOT modify these tables. They are the foundation for the take-home project.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Properties
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500),
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name)
);

CREATE INDEX idx_properties_status ON properties(status);

-- Unit Types
CREATE TABLE unit_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id),
  name VARCHAR(100) NOT NULL,
  bedrooms INT,
  bathrooms DECIMAL(3,1),
  square_footage INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, name)
);

-- Units
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id),
  unit_type_id UUID NOT NULL REFERENCES unit_types(id),
  unit_number VARCHAR(50) NOT NULL,
  floor INT,
  status VARCHAR(50) DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, unit_number)
);

CREATE INDEX idx_units_property_id ON units(property_id);
CREATE INDEX idx_units_status ON units(status);

-- Unit Pricing (tracks historical pricing)
CREATE TABLE unit_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES units(id),
  base_rent DECIMAL(10,2) NOT NULL,
  market_rent DECIMAL(10,2) NOT NULL,
  effective_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(unit_id, effective_date)
);

CREATE INDEX idx_unit_pricing_unit_id ON unit_pricing(unit_id);
CREATE INDEX idx_unit_pricing_effective_date ON unit_pricing(effective_date);

-- Residents
CREATE TABLE residents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id),
  unit_id UUID NOT NULL REFERENCES units(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'active',
  move_in_date DATE,
  move_out_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_residents_property_id ON residents(property_id);
CREATE INDEX idx_residents_unit_id ON residents(unit_id);
CREATE INDEX idx_residents_status ON residents(status);

-- Leases
CREATE TABLE leases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id),
  resident_id UUID NOT NULL REFERENCES residents(id),
  unit_id UUID NOT NULL REFERENCES units(id),
  lease_start_date DATE NOT NULL,
  lease_end_date DATE NOT NULL,
  monthly_rent DECIMAL(10,2) NOT NULL,
  lease_type VARCHAR(50) DEFAULT 'fixed',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leases_property_id ON leases(property_id);
CREATE INDEX idx_leases_resident_id ON leases(resident_id);
CREATE INDEX idx_leases_lease_end_date ON leases(lease_end_date);
CREATE INDEX idx_leases_status ON leases(status);

-- Resident Ledger (financial transactions)
CREATE TABLE resident_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id),
  resident_id UUID NOT NULL REFERENCES residents(id),
  transaction_type VARCHAR(50) NOT NULL,
  charge_code VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  transaction_date DATE NOT NULL,
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_resident_ledger_property_id ON resident_ledger(property_id);
CREATE INDEX idx_resident_ledger_resident_id ON resident_ledger(resident_id);
CREATE INDEX idx_resident_ledger_transaction_date ON resident_ledger(transaction_date);
CREATE INDEX idx_resident_ledger_transaction_type ON resident_ledger(transaction_type);

-- Renewal Offers
CREATE TABLE renewal_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id),
  resident_id UUID NOT NULL REFERENCES residents(id),
  lease_id UUID NOT NULL REFERENCES leases(id),
  renewal_start_date DATE NOT NULL,
  renewal_end_date DATE,
  proposed_rent DECIMAL(10,2),
  offer_expiration_date DATE,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_renewal_offers_property_id ON renewal_offers(property_id);
CREATE INDEX idx_renewal_offers_resident_id ON renewal_offers(resident_id);
CREATE INDEX idx_renewal_offers_status ON renewal_offers(status);

-- Renewal Risk Scores (provided for Jr. candidates — just write the logic to populate it)
CREATE TABLE renewal_risk_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id),
  resident_id UUID NOT NULL REFERENCES residents(id),
  lease_id UUID NOT NULL REFERENCES leases(id),
  risk_score INT NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_tier VARCHAR(10) NOT NULL CHECK (risk_tier IN ('high', 'medium', 'low')),
  days_to_expiry INT,
  is_delinquent BOOLEAN DEFAULT FALSE,
  has_renewal_offer BOOLEAN DEFAULT FALSE,
  rent_gap_pct DECIMAL(5,2) DEFAULT 0,
  calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_renewal_risk_scores_property_id ON renewal_risk_scores(property_id);
CREATE INDEX idx_renewal_risk_scores_resident_id ON renewal_risk_scores(resident_id);
CREATE INDEX idx_renewal_risk_scores_risk_tier ON renewal_risk_scores(risk_tier);
CREATE INDEX idx_renewal_risk_scores_calculated_at ON renewal_risk_scores(calculated_at);
