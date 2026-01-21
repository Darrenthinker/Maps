import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const BASE_STYLE = {
  version: 8,
  glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors"
    }
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm"
    }
  ]
};

export function createMaplibreAdapter(mapId, options = {}) {
  const isGlobe = options.mode === "globe";
  const initialZoom = isGlobe ? 1.0 : 2;

  const map = new maplibregl.Map({
    container: mapId,
    style: BASE_STYLE,
    center: [0, 20],
    zoom: initialZoom,
    antialias: true,
    minZoom: isGlobe ? 0.3 : 2,
    maxPitch: isGlobe ? 85 : 60
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

  // Set globe projection after map loads
  map.on("load", () => {
    if (isGlobe) {
      // Use setProjection API for globe
      map.setProjection("globe");
      
      // Add atmosphere/fog effect
      map.setFog({
        range: [0.5, 10],
        "horizon-blend": 0.3,
        color: "white",
        "high-color": "#add8e6",
        "space-color": "#1a1a2e",
        "star-intensity": 0.15
      });
    }
  });

  let cachedNodes = [];

  function buildGeoJson(nodes) {
    return {
      type: "FeatureCollection",
      features: nodes.map((node) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [node.lng, node.lat]
        },
        properties: {
          id: node.id,
          type: node.type,
          name: node.name,
          popupHtml: node.popupHtml
        }
      }))
    };
  }

  function ensureLayers() {
    if (map.getSource("nodes")) return;
    map.addSource("nodes", {
      type: "geojson",
      data: buildGeoJson(cachedNodes),
      cluster: true,
      clusterMaxZoom: 7,
      clusterRadius: 60
    });

    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "nodes",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step",
          ["get", "point_count"],
          "#a3d9a5",
          100,
          "#f6c56b",
          1000,
          "#f28c55"
        ],
        "circle-radius": [
          "step",
          ["get", "point_count"],
          18,
          100,
          26,
          1000,
          34
        ],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2
      }
    });

    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "nodes",
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["Open Sans Regular"],
        "text-size": 12
      },
      paint: {
        "text-color": "#1f2933"
      }
    });

    map.addLayer({
      id: "unclustered-point",
      type: "circle",
      source: "nodes",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": [
          "match",
          ["get", "type"],
          "airport",
          "#2563eb",
          "port",
          "#f97316",
          "#64748b"
        ],
        "circle-radius": 6,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5
      }
    });

    map.on("click", "clusters", (event) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: ["clusters"]
      });
      const clusterId = features[0].properties.cluster_id;
      map.getSource("nodes").getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        map.easeTo({
          center: features[0].geometry.coordinates,
          zoom
        });
      });
    });

    map.on("click", "unclustered-point", (event) => {
      const feature = event.features[0];
      const coordinates = feature.geometry.coordinates.slice();
      const popupHtml = feature.properties.popupHtml;
      new maplibregl.Popup({ offset: 12 }).setLngLat(coordinates).setHTML(popupHtml).addTo(map);
    });

    map.on("mouseenter", "clusters", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "clusters", () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseenter", "unclustered-point", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "unclustered-point", () => {
      map.getCanvas().style.cursor = "";
    });
  }

  function setMarkers(nodes) {
    cachedNodes = nodes;
    if (!map.isStyleLoaded()) {
      map.once("load", () => {
        ensureLayers();
        map.getSource("nodes").setData(buildGeoJson(cachedNodes));
      });
      return;
    }
    ensureLayers();
    map.getSource("nodes").setData(buildGeoJson(nodes));
  }

  function focusOn(node) {
    if (!node) return;
    map.easeTo({ center: [node.lng, node.lat], zoom: 6 });
    new maplibregl.Popup({ offset: 12 })
      .setLngLat([node.lng, node.lat])
      .setHTML(node.popupHtml)
      .addTo(map);
  }

  return {
    setMarkers,
    focusOn,
    destroy: () => map.remove()
  };
}

