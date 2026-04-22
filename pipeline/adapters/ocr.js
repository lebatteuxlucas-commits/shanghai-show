// pipeline/adapters/ocr.js
// OCR adapter interface + mock implementation.
//
// To plug in a real provider (Tesseract.js, Google Document AI, AWS Textract):
//   1. Implement the same interface: { extractPages(file, opts) → Promise<string[]> }
//   2. Replace Pipeline.adapters.ocr with your adapter before calling the pipeline.
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});
  P.adapters = P.adapters || {};

  // ── Interface contract ─────────────────────────────────────────────────────
  // extractPages(fileOrMockId, opts?) → Promise<string[]>
  //   Returns one string per page — raw extracted text.

  // ── Mock implementation ────────────────────────────────────────────────────
  // Returns pre-written catalog text for known mock IDs.
  // For unknown files, generates plausible placeholder text.
  const mockOcr = {
    name: 'mock-ocr',
    async extractPages(fileOrMockId, opts) {
      await _delay(200 + Math.random() * 300);  // simulate latency

      const id = typeof fileOrMockId === 'string' ? fileOrMockId : (fileOrMockId?.name || 'unknown');

      const fixture = MOCK_FIXTURES[id];
      if (fixture) return fixture;

      // Fallback: single-page placeholder
      return [`[Mock OCR — no fixture for "${id}". Attach a real OCR adapter to process this file.]`];
    },
  };

  // Expose an overridable slot so the orchestrator picks up real adapters.
  P.adapters.ocr = mockOcr;

  // ── Fake latency ──────────────────────────────────────────────────────────
  function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Mock fixtures ─────────────────────────────────────────────────────────
  // Keyed by mock catalog ID (same IDs used in sample-data.js).
  const MOCK_FIXTURES = {

    'mock_xiongfeng_motors': [
      // Page 1 — cover
      `SUZHOU XIONGFENG MOTOR CO., LTD.
2025 E-Bike Drive Systems Catalog
Hall E5 · Booth 229 · China Cycle 2025, Shanghai

Specialising in brushless hub motors, mid-drive systems, controllers and PAS sensors.
ISO 9001:2015 certified. CE / EN15194 / RoHS compliant product lines.
Export markets: EU, North America, Southeast Asia.
Contact: sales@xofomotor.com · www.xofomotor.com`,

      // Page 2 — hub motor
      `PRODUCT: SF-250R Rear Hub Motor
Reference: SF-250R-36V
Category: Hub Motor

High-efficiency 250W brushless rear hub motor for urban and trekking e-bikes.
Designed for EN15194 compliance (EU pedelec standard).
Integrated torque arm, waterproof connectors.

Specifications:
Rated Power: 250W
Peak Power: 400W
Voltage: 36V
Max Torque: 40Nm
No-load Speed: 220rpm
Efficiency: ≥85%
IP Rating: IP54
Axle: 10mm quick release, 135mm dropout
Connector: Waterproof 9-pin Julet
Weight: 2.8kg

Certifications: CE, EN15194, RoHS 2011/65/EU
Compatible with: 26", 27.5", 700c wheels; 135mm QR dropout
Colors available: Black, Silver
MOQ: 50 units / order
Price: USD 28–36 EXW Suzhou
Positioning: Entry to Mid`,

      // Page 3 — mid-drive
      `PRODUCT: SF-500M Mid-Drive Motor System
Reference: SF-500M-48V-TS
Category: Mid-Drive Motor

Torque-sensing mid-drive motor system delivering natural pedal feel.
Suitable for trekking, cargo and e-MTB applications.
Includes motor, controller (integrated), Bluetooth display, and PAS sensor.

Specifications:
Rated Power: 500W (48V)
Peak Power: 750W
Voltage: 48V
Rated Torque: 85Nm
Gear Ratio: 1:22.5 internal
Weight: 3.2kg (motor unit only)
BB Threading: 68mm BSA / 73mm MTB
Connector: IP67 rated

Certifications: CE, EN15194, RoHS, EPAC compliant
Compatible with: Standard 68/73mm bottom bracket shells
Colors: Black
MOQ: 20 units
Price: USD 95–130 EXW Suzhou
Positioning: Premium`,

      // Page 4 — controller
      `PRODUCT: SF-CT36V20 Sine-Wave Controller
Reference: SF-CT36V20-SW
Category: Controller

36V 20A sine-wave FOC controller for smooth, quiet operation.
Pre-wired for KT LCD display protocol. Anti-theft switch input.

Specifications:
Input Voltage: 36V (30–42V range)
Continuous Current: 20A
Peak Current: 30A
Phase wires: 3×0.75mm²
IP Rating: IP65
Dimensions: 140×75×35mm
Weight: 320g

Certifications: CE, RoHS
MOQ: 100 units
Price: USD 8.50–12 EXW Suzhou
Channel: OEM
Region: EU-suitable`,

      // Page 5 — display
      `PRODUCT: SF-DP850C Colour LCD Display
Reference: SF-DP850C
Category: Display

2.5" colour LCD display with backlight. Compatible with KT UART and VLCD6 protocols.
USB charging port 5V/1A. 5-button control pad.

Specifications:
Screen: 2.5" TFT colour LCD
Brightness: 300 nit
Protocol: KT UART / VLCD5 / VLCD6
IP Rating: IPX5
Operating Temp: -20°C to +60°C
USB: 5V / 1A output
Dimensions: 98×60×18mm

Certifications: CE, FCC
MOQ: 100 units
Price: USD 6–9.50 EXW Suzhou
Channel: OEM
Colors: Black`,
    ],

    'mock_ponely_tires': [
      // Page 1 — company overview
      `JIANGSU PONELY RUBBER CO., LTD.
(formerly Jiangsu Feiyue Rubber Co., Ltd.)
2025 Bicycle & E-Bike Tire Catalog
Hall E4 · China Cycle 2025

Manufacturer of bicycle inner tubes, outer tyres for road, MTB, e-bike and cargo applications.
Annual capacity: 12M units. ISO 9001, ISO 14001.`,

      // Page 2 — city tire
      `PRODUCT: City & Trekking E-Bike Tyre 700×50C
Reference: PNL-700-50C-EB
Category: Tyre

Puncture-resistant city/trekking tyre rated for 25kg+ e-bike use.
Reflective sidewall strip for StVZO visibility compliance.
Double-compound tread: hard centre + soft shoulder.

Specifications:
Size: 700×50C (ETRTO 50-622)
Load Rating: 120kg per tyre
Max Pressure: 5.5 bar / 80 psi
Tread Compound: 60a centre / 50a shoulder
Puncture Belt: 3mm nylon breaker
Sidewall: Reflective yellow strip
Weight: 680g

Certifications: ECE R-75 (e-bike speed category), EN ISO 8098
Compatible with: 622mm rim (700c); e-bikes up to 45km/h
Colors: Black with reflective stripe
MOQ: 200 units
Price: USD 4.20–5.80 EXW Jiangsu
Channel: OEM
Region: EU`,

      // Page 3 — MTB tire
      `PRODUCT: MTB Tyre 29×2.35"
Reference: PNL-29-235-XC
Category: Tyre

Cross-country MTB tyre with file tread centre and ramped side knobs.
Suitable for hardpack and mixed terrain.

Specifications:
Size: 29×2.35" (ETRTO 60-622)
Compound: 62a
Foldable Bead: yes (Kevlar)
Casing: 60 TPI
Weight: 720g
Max Pressure: 4.5 bar

Certifications: ISO 8098
MOQ: 200 units
Price: USD 3.80–5.20 EXW
Channel: Both OEM and aftermarket
Positioning: Mid`,

      // Page 4 — inner tube
      `PRODUCT: Schrader Inner Tube 700×35–50C
Reference: PNL-IT-700-AV
Category: Inner Tube

Standard butyl inner tube for 700c touring and e-bike tyres.
Valve: 48mm Schrader (AV). Also available: Presta (FV).

Specifications:
Size compatibility: 700×35C–700×50C
Valve: 48mm Schrader AV
Wall thickness: 1.5mm
Material: Butyl rubber
Weight: 180g

MOQ: 500 units
Price: USD 0.65–0.95 EXW Jiangsu
Channel: Both
Positioning: Entry`,
    ],

    'mock_gineyea_accessories': [
      // Page 1 — cover
      `SHENZHEN GINEYEA TECHNOLOGY CO., LTD.
Bicycle Components & Accessories Catalog 2025
Hall E2 · Booth 145 · China Cycle 2025

Product lines: pedals, bottom brackets, headsets, stems, saddle clamps.
Export: 65% EU market; Aluminium forging in-house.
Certifications: EN 14781 (pedals)`,

      // Page 2 — alloy pedal
      `PRODUCT: Forged Alloy Flat Pedal 110×100mm
Reference: GY-PDL-F110-SLV
Category: Pedal

CNC-machined platform from 6061-T6 aluminium forging. Sealed cartridge axle bearing.
9 stainless steel pins per side, removable.

Specifications:
Platform: 110×100mm
Axle: CrMo steel, 9/16" thread
Bearing: Sealed cartridge × 2
Weight: 340g/pair
Stack height: 17mm
Pin count: 9+9
Pin material: 304 SS, replaceable

Certifications: EN 14781
Compatible with: Standard 9/16" crank arms
Colors: Silver, Black, Red, Blue
MOQ: 200 pairs
Price: USD 4.50–6.00 EXW Shenzhen
Channel: Aftermarket
Positioning: Mid`,

      // Page 3 — city pedal (OEM)
      `PRODUCT: Nylon Composite City Pedal 9/16"
Reference: GY-PDL-NY916
Category: Pedal

Injection-moulded PA6+GF30 nylon platform for OEM city bike and e-bike fitment.
Anti-slip tread pattern. Available with or without reflectors (EN13895).

Specifications:
Platform: 102×95mm
Axle: CrMo 9/16"
Material: PA6+GF30 nylon
Weight: 220g/pair
Reflectors: Optional (EN13895 amber)

Certifications: optional EN13895 pedal reflectors
Colors: Black, Grey
MOQ: 1000 pairs
Price: USD 1.20–1.60 EXW Shenzhen
Channel: OEM
Positioning: Entry`,

      // Page 4 — headset (weak data — tests inferred/missing fields)
      `PRODUCT: Ahead Threadless Headset 1-1/8"
Reference: GY-HS118

Sealed cartridge bearings, 45°/45° contact angle.
Available in standard and integrated (ZS) versions.

Colors: Black
Price: around USD 2.50–3.80
MOQ 500 sets`,
    ],

    'mock_unknown_supplier': [
      // Intentionally weak — tests review queue assignment
      `NEW E-BIKE ACCESSORY PRODUCTS 2025

LED Front Light Model A — 800 lumen, IP55, 6–48V input, StVZO K-Mark
Ref: FL-800-STVZO
Price on request. MOQ 200pcs.

Rear Tail Light USB-C Rechargeable
Ref: RL-50-USB-C
50 lumens, 8–72h runtime. CE.
MOQ 500 / USD 2.40–3.50

Bell — classic 57mm alloy ring bell
Ref: BL-57
MOQ 1000 / USD 0.60–0.90

Contact us for full catalogue.`,
    ],
  };

  P.adapters._mockFixtures = MOCK_FIXTURES;  // exposed for testing
}());
