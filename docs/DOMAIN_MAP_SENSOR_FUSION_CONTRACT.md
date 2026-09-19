# VERISCOPE domain map contract

The approved geographic map shell is invariant. Domain selection changes the operational lens, not the base geography.

## Domain lenses

- Earth: satellite, ground weather radar, SAR, seismic, fire and environmental observations.
- Aviation: SIGMETs, aviation weather, airports, flight-relevant hazards and aviation records.
- Maritime: vessel traffic, navigation, ports, ocean and maritime infrastructure.
- Land: infrastructure, emergency, contracts and terrestrial operational records.
- Cyber: geospatial context only when a cyber record has defensible location evidence; otherwise use entity/network views.
- Trade / Corporate: routes, jurisdictions, facilities and entity relationships only where location is evidential.
- SAFEPLATE: food recalls, outbreaks, facilities, distribution and supply-chain geography.
- NORTHLINE: school, district, transportation and school-safety geography.

## Platform isolation

VERISCOPE CORE may correlate across authorized domains. Separate Function Media platforms consume only their approved domain contracts. A platform must not inherit unrelated markers, feeds, controls, terminology or findings merely because it uses the same map engine.

## Map invariant

Do not replace, restyle, recenter globally, or remove the approved map. Domain switching changes overlays, markers, tracks, legends, controls, evidence panels, defaults and camera focus. The geographic engine remains stable.

## Sensor semantics

NEXRAD = ground-based weather radar.
Sentinel-1 = spaceborne synthetic aperture radar.
GOES, MODIS/VIIRS, Landsat and Sentinel-2 = satellite remote sensing.

Never label a source LIVE merely because an endpoint responded. Surface source retrieval time, newest observation time, observation age, records returned, errors and expected cadence.
