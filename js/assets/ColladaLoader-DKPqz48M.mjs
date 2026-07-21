import { $ as DataTextureLoader, a0 as LinearMipmapLinearFilter, a1 as MathUtils, C as Color, a2 as ColorManagement, i as SRGBColorSpace, V as Vector3, b as Matrix4, Q as Quaternion, a3 as VectorKeyframeTrack, a4 as QuaternionKeyframeTrack, a5 as InterpolateDiscrete, a6 as InterpolateBezier, a7 as AnimationClip, a8 as MeshBasicMaterial, a9 as MeshLambertMaterial, aa as MeshPhongMaterial, a as Vector2, D as DoubleSide, ab as FrontSide, j as PerspectiveCamera, O as OrthographicCamera, ac as AmbientLight, ad as SpotLight, ae as PointLight, af as DirectionalLight, B as BufferGeometry, F as Float32BufferAttribute, ag as Triangle, ah as ShapeUtils, ai as Skeleton, aj as Bone, ak as Group, w as Loader, al as LineBasicMaterial, am as SkinnedMesh, M as Mesh, an as Line, ao as LineSegments, ap as RepeatWrapping, aq as ClampToEdgeWrapping, ar as LoaderUtils, x as FileLoader, as as Scene, at as TextureLoader } from "./main-E4blGWV4.mjs";
class TGALoader extends DataTextureLoader {
  /**
   * Constructs a new TGA loader.
   *
   * @param {LoadingManager} [manager] - The loading manager.
   */
  constructor(manager) {
    super(manager);
  }
  /**
   * Parses the given TGA texture data.
   *
   * @param {ArrayBuffer} buffer - The raw texture data.
   * @return {DataTextureLoader~TexData} An object representing the parsed texture data.
   */
  parse(buffer) {
    function tgaCheckHeader(header2) {
      switch (header2.image_type) {
        // check indexed type
        case TGA_TYPE_INDEXED:
        case TGA_TYPE_RLE_INDEXED:
          if (header2.colormap_length > 256 || header2.colormap_size !== 24 || header2.colormap_type !== 1) {
            throw new Error("THREE.TGALoader: Invalid type colormap data for indexed type.");
          }
          break;
        // check colormap type
        case TGA_TYPE_RGB:
        case TGA_TYPE_GREY:
        case TGA_TYPE_RLE_RGB:
        case TGA_TYPE_RLE_GREY:
          if (header2.colormap_type) {
            throw new Error("THREE.TGALoader: Invalid type colormap data for colormap type.");
          }
          break;
        // What the need of a file without data ?
        case TGA_TYPE_NO_DATA:
          throw new Error("THREE.TGALoader: No data.");
        // Invalid type ?
        default:
          throw new Error("THREE.TGALoader: Invalid type " + header2.image_type);
      }
      if (header2.width <= 0 || header2.height <= 0) {
        throw new Error("THREE.TGALoader: Invalid image size.");
      }
      if (header2.pixel_size !== 8 && header2.pixel_size !== 16 && header2.pixel_size !== 24 && header2.pixel_size !== 32) {
        throw new Error("THREE.TGALoader: Invalid pixel size " + header2.pixel_size);
      }
    }
    function tgaParse(use_rle2, use_pal2, header2, offset2, data) {
      let pixel_data, palettes;
      const pixel_size = header2.pixel_size >> 3;
      const pixel_total = header2.width * header2.height * pixel_size;
      if (use_pal2) {
        palettes = data.subarray(offset2, offset2 += header2.colormap_length * (header2.colormap_size >> 3));
      }
      if (use_rle2) {
        pixel_data = new Uint8Array(pixel_total);
        let c, count, i;
        let shift = 0;
        const pixels = new Uint8Array(pixel_size);
        while (shift < pixel_total) {
          c = data[offset2++];
          count = (c & 127) + 1;
          if (c & 128) {
            for (i = 0; i < pixel_size; ++i) {
              pixels[i] = data[offset2++];
            }
            for (i = 0; i < count; ++i) {
              pixel_data.set(pixels, shift + i * pixel_size);
            }
            shift += pixel_size * count;
          } else {
            count *= pixel_size;
            for (i = 0; i < count; ++i) {
              pixel_data[shift + i] = data[offset2++];
            }
            shift += count;
          }
        }
      } else {
        pixel_data = data.subarray(
          offset2,
          offset2 += use_pal2 ? header2.width * header2.height : pixel_total
        );
      }
      return {
        pixel_data,
        palettes
      };
    }
    function tgaGetImageData8bits(imageData2, y_start, y_step, y_end, x_start, x_step, x_end, image, palettes) {
      const colormap = palettes;
      let color, i = 0, x, y;
      const width = header.width;
      for (y = y_start; y !== y_end; y += y_step) {
        for (x = x_start; x !== x_end; x += x_step, i++) {
          color = image[i];
          imageData2[(x + width * y) * 4 + 3] = 255;
          imageData2[(x + width * y) * 4 + 2] = colormap[color * 3 + 0];
          imageData2[(x + width * y) * 4 + 1] = colormap[color * 3 + 1];
          imageData2[(x + width * y) * 4 + 0] = colormap[color * 3 + 2];
        }
      }
      return imageData2;
    }
    function tgaGetImageData16bits(imageData2, y_start, y_step, y_end, x_start, x_step, x_end, image) {
      let color, i = 0, x, y;
      const width = header.width;
      for (y = y_start; y !== y_end; y += y_step) {
        for (x = x_start; x !== x_end; x += x_step, i += 2) {
          color = image[i + 0] + (image[i + 1] << 8);
          imageData2[(x + width * y) * 4 + 0] = (color & 31744) >> 7;
          imageData2[(x + width * y) * 4 + 1] = (color & 992) >> 2;
          imageData2[(x + width * y) * 4 + 2] = (color & 31) << 3;
          imageData2[(x + width * y) * 4 + 3] = color & 32768 ? 0 : 255;
        }
      }
      return imageData2;
    }
    function tgaGetImageData24bits(imageData2, y_start, y_step, y_end, x_start, x_step, x_end, image) {
      let i = 0, x, y;
      const width = header.width;
      for (y = y_start; y !== y_end; y += y_step) {
        for (x = x_start; x !== x_end; x += x_step, i += 3) {
          imageData2[(x + width * y) * 4 + 3] = 255;
          imageData2[(x + width * y) * 4 + 2] = image[i + 0];
          imageData2[(x + width * y) * 4 + 1] = image[i + 1];
          imageData2[(x + width * y) * 4 + 0] = image[i + 2];
        }
      }
      return imageData2;
    }
    function tgaGetImageData32bits(imageData2, y_start, y_step, y_end, x_start, x_step, x_end, image) {
      let i = 0, x, y;
      const width = header.width;
      for (y = y_start; y !== y_end; y += y_step) {
        for (x = x_start; x !== x_end; x += x_step, i += 4) {
          imageData2[(x + width * y) * 4 + 2] = image[i + 0];
          imageData2[(x + width * y) * 4 + 1] = image[i + 1];
          imageData2[(x + width * y) * 4 + 0] = image[i + 2];
          imageData2[(x + width * y) * 4 + 3] = image[i + 3];
        }
      }
      return imageData2;
    }
    function tgaGetImageDataGrey8bits(imageData2, y_start, y_step, y_end, x_start, x_step, x_end, image) {
      let color, i = 0, x, y;
      const width = header.width;
      for (y = y_start; y !== y_end; y += y_step) {
        for (x = x_start; x !== x_end; x += x_step, i++) {
          color = image[i];
          imageData2[(x + width * y) * 4 + 0] = color;
          imageData2[(x + width * y) * 4 + 1] = color;
          imageData2[(x + width * y) * 4 + 2] = color;
          imageData2[(x + width * y) * 4 + 3] = 255;
        }
      }
      return imageData2;
    }
    function tgaGetImageDataGrey16bits(imageData2, y_start, y_step, y_end, x_start, x_step, x_end, image) {
      let i = 0, x, y;
      const width = header.width;
      for (y = y_start; y !== y_end; y += y_step) {
        for (x = x_start; x !== x_end; x += x_step, i += 2) {
          imageData2[(x + width * y) * 4 + 0] = image[i + 0];
          imageData2[(x + width * y) * 4 + 1] = image[i + 0];
          imageData2[(x + width * y) * 4 + 2] = image[i + 0];
          imageData2[(x + width * y) * 4 + 3] = image[i + 1];
        }
      }
      return imageData2;
    }
    function getTgaRGBA(data, width, height, image, palette) {
      let x_start, y_start, x_step, y_step, x_end, y_end;
      switch ((header.flags & TGA_ORIGIN_MASK) >> TGA_ORIGIN_SHIFT) {
        default:
        case TGA_ORIGIN_UL:
          x_start = 0;
          x_step = 1;
          x_end = width;
          y_start = 0;
          y_step = 1;
          y_end = height;
          break;
        case TGA_ORIGIN_BL:
          x_start = 0;
          x_step = 1;
          x_end = width;
          y_start = height - 1;
          y_step = -1;
          y_end = -1;
          break;
        case TGA_ORIGIN_UR:
          x_start = width - 1;
          x_step = -1;
          x_end = -1;
          y_start = 0;
          y_step = 1;
          y_end = height;
          break;
        case TGA_ORIGIN_BR:
          x_start = width - 1;
          x_step = -1;
          x_end = -1;
          y_start = height - 1;
          y_step = -1;
          y_end = -1;
          break;
      }
      if (use_grey) {
        switch (header.pixel_size) {
          case 8:
            tgaGetImageDataGrey8bits(data, y_start, y_step, y_end, x_start, x_step, x_end, image);
            break;
          case 16:
            tgaGetImageDataGrey16bits(data, y_start, y_step, y_end, x_start, x_step, x_end, image);
            break;
          default:
            throw new Error("THREE.TGALoader: Format not supported.");
        }
      } else {
        switch (header.pixel_size) {
          case 8:
            tgaGetImageData8bits(data, y_start, y_step, y_end, x_start, x_step, x_end, image, palette);
            break;
          case 16:
            tgaGetImageData16bits(data, y_start, y_step, y_end, x_start, x_step, x_end, image);
            break;
          case 24:
            tgaGetImageData24bits(data, y_start, y_step, y_end, x_start, x_step, x_end, image);
            break;
          case 32:
            tgaGetImageData32bits(data, y_start, y_step, y_end, x_start, x_step, x_end, image);
            break;
          default:
            throw new Error("THREE.TGALoader: Format not supported.");
        }
      }
      return data;
    }
    const TGA_TYPE_NO_DATA = 0, TGA_TYPE_INDEXED = 1, TGA_TYPE_RGB = 2, TGA_TYPE_GREY = 3, TGA_TYPE_RLE_INDEXED = 9, TGA_TYPE_RLE_RGB = 10, TGA_TYPE_RLE_GREY = 11, TGA_ORIGIN_MASK = 48, TGA_ORIGIN_SHIFT = 4, TGA_ORIGIN_BL = 0, TGA_ORIGIN_BR = 1, TGA_ORIGIN_UL = 2, TGA_ORIGIN_UR = 3;
    if (buffer.length < 19) throw new Error("THREE.TGALoader: Not enough data to contain header.");
    let offset = 0;
    const content = new Uint8Array(buffer), header = {
      id_length: content[offset++],
      colormap_type: content[offset++],
      image_type: content[offset++],
      colormap_index: content[offset++] | content[offset++] << 8,
      colormap_length: content[offset++] | content[offset++] << 8,
      colormap_size: content[offset++],
      origin: [
        content[offset++] | content[offset++] << 8,
        content[offset++] | content[offset++] << 8
      ],
      width: content[offset++] | content[offset++] << 8,
      height: content[offset++] | content[offset++] << 8,
      pixel_size: content[offset++],
      flags: content[offset++]
    };
    tgaCheckHeader(header);
    if (header.id_length + offset > buffer.length) {
      throw new Error("THREE.TGALoader: No data.");
    }
    offset += header.id_length;
    let use_rle = false, use_pal = false, use_grey = false;
    switch (header.image_type) {
      case TGA_TYPE_RLE_INDEXED:
        use_rle = true;
        use_pal = true;
        break;
      case TGA_TYPE_INDEXED:
        use_pal = true;
        break;
      case TGA_TYPE_RLE_RGB:
        use_rle = true;
        break;
      case TGA_TYPE_RGB:
        break;
      case TGA_TYPE_RLE_GREY:
        use_rle = true;
        use_grey = true;
        break;
      case TGA_TYPE_GREY:
        use_grey = true;
        break;
    }
    const imageData = new Uint8Array(header.width * header.height * 4);
    const result = tgaParse(use_rle, use_pal, header, offset, content);
    getTgaRGBA(imageData, header.width, header.height, result.pixel_data, result.palettes);
    return {
      data: imageData,
      width: header.width,
      height: header.height,
      flipY: true,
      generateMipmaps: true,
      minFilter: LinearMipmapLinearFilter
    };
  }
}
function getElementsByTagName(xml, name) {
  const array = [];
  const childNodes = xml.childNodes;
  for (let i = 0, l = childNodes.length; i < l; i++) {
    const child = childNodes[i];
    if (child.nodeName === name) {
      array.push(child);
    }
  }
  return array;
}
function parseStrings(text) {
  if (text.length === 0) return [];
  return text.trim().split(/\s+/);
}
function parseFloats(text) {
  if (text.length === 0) return [];
  return text.trim().split(/\s+/).map(parseFloat);
}
function parseInts(text) {
  if (text.length === 0) return [];
  return text.trim().split(/\s+/).map((s) => parseInt(s));
}
function parseId(text) {
  return text.substring(1);
}
class ColladaParser {
  constructor() {
    this.count = 0;
  }
  generateId() {
    return "three_default_" + this.count++;
  }
  parse(text) {
    if (text.length === 0) {
      return null;
    }
    const xml = new DOMParser().parseFromString(text, "application/xml");
    const collada = getElementsByTagName(xml, "COLLADA")[0];
    const parserError = xml.getElementsByTagName("parsererror")[0];
    if (parserError !== void 0) {
      const errorElement = getElementsByTagName(parserError, "div")[0];
      let errorText;
      if (errorElement) {
        errorText = errorElement.textContent;
      } else {
        errorText = this.parserErrorToText(parserError);
      }
      console.error("THREE.ColladaLoader: Failed to parse collada file.\n", errorText);
      return null;
    }
    const version = collada.getAttribute("version");
    console.debug("THREE.ColladaLoader: File version", version);
    const asset = this.parseAsset(getElementsByTagName(collada, "asset")[0]);
    const library = {
      animations: {},
      clips: {},
      controllers: {},
      images: {},
      effects: {},
      materials: {},
      cameras: {},
      lights: {},
      geometries: {},
      nodes: {},
      visualScenes: {},
      kinematicsModels: {},
      physicsModels: {},
      kinematicsScenes: {},
      joints: {}
    };
    this.library = library;
    this.collada = collada;
    this.parseLibrary(collada, "library_animations", "animation", this.parseAnimation.bind(this));
    this.parseLibrary(collada, "library_animation_clips", "animation_clip", this.parseAnimationClip.bind(this));
    this.parseLibrary(collada, "library_controllers", "controller", this.parseController.bind(this));
    this.parseLibrary(collada, "library_images", "image", this.parseImage.bind(this));
    this.parseLibrary(collada, "library_effects", "effect", this.parseEffect.bind(this));
    this.parseLibrary(collada, "library_materials", "material", this.parseMaterial.bind(this));
    this.parseLibrary(collada, "library_cameras", "camera", this.parseCamera.bind(this));
    this.parseLibrary(collada, "library_lights", "light", this.parseLight.bind(this));
    this.parseLibrary(collada, "library_geometries", "geometry", this.parseGeometry.bind(this));
    this.parseLibrary(collada, "library_nodes", "node", this.parseNode.bind(this));
    this.parseLibrary(collada, "library_visual_scenes", "visual_scene", this.parseVisualScene.bind(this));
    this.parseLibrary(collada, "library_joints", "joint", this.parseLibraryJoint.bind(this));
    this.parseLibrary(collada, "library_kinematics_models", "kinematics_model", this.parseKinematicsModel.bind(this));
    this.parseLibrary(collada, "library_physics_models", "physics_model", this.parsePhysicsModel.bind(this));
    this.parseLibrary(collada, "scene", "instance_kinematics_scene", this.parseKinematicsScene.bind(this));
    return {
      library,
      asset,
      collada
    };
  }
  // convert the parser error element into text with each child elements text
  // separated by new lines.
  parserErrorToText(parserError) {
    const parts = [];
    const stack = [parserError];
    while (stack.length) {
      const node = stack.shift();
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent);
      } else {
        parts.push("\n");
        stack.push(...node.childNodes);
      }
    }
    return parts.join("").trim();
  }
  // asset
  parseAsset(xml) {
    return {
      unit: this.parseAssetUnit(getElementsByTagName(xml, "unit")[0]),
      upAxis: this.parseAssetUpAxis(getElementsByTagName(xml, "up_axis")[0])
    };
  }
  parseAssetUnit(xml) {
    if (xml !== void 0 && xml.hasAttribute("meter") === true) {
      return parseFloat(xml.getAttribute("meter"));
    } else {
      return 1;
    }
  }
  parseAssetUpAxis(xml) {
    return xml !== void 0 ? xml.textContent : "Y_UP";
  }
  // library
  parseLibrary(xml, libraryName, nodeName, parser) {
    const library = getElementsByTagName(xml, libraryName)[0];
    if (library !== void 0) {
      const elements = getElementsByTagName(library, nodeName);
      for (let i = 0; i < elements.length; i++) {
        parser(elements[i]);
      }
    }
  }
  // animation
  parseAnimation(xml) {
    const data = {
      sources: {},
      samplers: {},
      channels: {}
    };
    let hasChildren = false;
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      let id;
      switch (child.nodeName) {
        case "source":
          id = child.getAttribute("id");
          data.sources[id] = this.parseSource(child);
          break;
        case "sampler":
          id = child.getAttribute("id");
          data.samplers[id] = this.parseAnimationSampler(child);
          break;
        case "channel":
          id = child.getAttribute("target");
          data.channels[id] = this.parseAnimationChannel(child);
          break;
        case "animation":
          this.parseAnimation(child);
          hasChildren = true;
          break;
      }
    }
    if (hasChildren === false) {
      this.library.animations[xml.getAttribute("id") || MathUtils.generateUUID()] = data;
    }
  }
  parseAnimationSampler(xml) {
    const data = {
      inputs: {}
    };
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "input":
          const id = parseId(child.getAttribute("source"));
          const semantic = child.getAttribute("semantic");
          data.inputs[semantic] = id;
          break;
      }
    }
    return data;
  }
  parseAnimationChannel(xml) {
    const data = {};
    const target = xml.getAttribute("target");
    let parts = target.split("/");
    const id = parts.shift();
    let sid = parts.shift();
    const arraySyntax = sid.indexOf("(") !== -1;
    const memberSyntax = sid.indexOf(".") !== -1;
    if (memberSyntax) {
      parts = sid.split(".");
      sid = parts.shift();
      data.member = parts.shift();
    } else if (arraySyntax) {
      const indices = sid.split("(");
      sid = indices.shift();
      for (let i = 0; i < indices.length; i++) {
        indices[i] = parseInt(indices[i].replace(/\)/, ""));
      }
      data.indices = indices;
    }
    data.id = id;
    data.sid = sid;
    data.arraySyntax = arraySyntax;
    data.memberSyntax = memberSyntax;
    data.sampler = parseId(xml.getAttribute("source"));
    return data;
  }
  // animation clips
  parseAnimationClip(xml) {
    const data = {
      name: xml.getAttribute("id") || "default",
      start: parseFloat(xml.getAttribute("start") || 0),
      end: parseFloat(xml.getAttribute("end") || 0),
      animations: []
    };
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "instance_animation":
          data.animations.push(parseId(child.getAttribute("url")));
          break;
      }
    }
    this.library.clips[xml.getAttribute("id")] = data;
  }
  // controller
  parseController(xml) {
    const data = {};
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "skin":
          data.id = parseId(child.getAttribute("source"));
          data.skin = this.parseSkin(child);
          break;
        case "morph":
          data.id = parseId(child.getAttribute("source"));
          console.warn("THREE.ColladaLoader: Morph target animation not supported yet.");
          break;
      }
    }
    this.library.controllers[xml.getAttribute("id")] = data;
  }
  parseSkin(xml) {
    const data = {
      sources: {}
    };
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "bind_shape_matrix":
          data.bindShapeMatrix = parseFloats(child.textContent);
          break;
        case "source":
          const id = child.getAttribute("id");
          data.sources[id] = this.parseSource(child);
          break;
        case "joints":
          data.joints = this.parseJoints(child);
          break;
        case "vertex_weights":
          data.vertexWeights = this.parseVertexWeights(child);
          break;
      }
    }
    return data;
  }
  parseJoints(xml) {
    const data = {
      inputs: {}
    };
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "input":
          const semantic = child.getAttribute("semantic");
          const id = parseId(child.getAttribute("source"));
          data.inputs[semantic] = id;
          break;
      }
    }
    return data;
  }
  parseVertexWeights(xml) {
    const data = {
      inputs: {}
    };
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "input":
          const semantic = child.getAttribute("semantic");
          const id = parseId(child.getAttribute("source"));
          const offset = parseInt(child.getAttribute("offset"));
          data.inputs[semantic] = { id, offset };
          break;
        case "vcount":
          data.vcount = parseInts(child.textContent);
          break;
        case "v":
          data.v = parseInts(child.textContent);
          break;
      }
    }
    return data;
  }
  // image
  parseImage(xml) {
    const data = {
      init_from: getElementsByTagName(xml, "init_from")[0].textContent
    };
    this.library.images[xml.getAttribute("id")] = data;
  }
  // effect
  parseEffect(xml) {
    const data = {};
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "profile_COMMON":
          data.profile = this.parseEffectProfileCOMMON(child);
          break;
      }
    }
    this.library.effects[xml.getAttribute("id")] = data;
  }
  parseEffectProfileCOMMON(xml) {
    const data = {
      surfaces: {},
      samplers: {}
    };
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "newparam":
          this.parseEffectNewparam(child, data);
          break;
        case "technique":
          data.technique = this.parseEffectTechnique(child);
          break;
        case "extra":
          data.extra = this.parseEffectExtra(child);
          break;
      }
    }
    return data;
  }
  parseEffectNewparam(xml, data) {
    const sid = xml.getAttribute("sid");
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "surface":
          data.surfaces[sid] = this.parseEffectSurface(child);
          break;
        case "sampler2D":
          data.samplers[sid] = this.parseEffectSampler(child);
          break;
      }
    }
  }
  parseEffectSurface(xml) {
    const data = {};
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "init_from":
          data.init_from = child.textContent;
          break;
      }
    }
    return data;
  }
  parseEffectSampler(xml) {
    const data = {};
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "source":
          data.source = child.textContent;
          break;
      }
    }
    return data;
  }
  parseEffectTechnique(xml) {
    const data = {};
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "constant":
        case "lambert":
        case "blinn":
        case "phong":
          data.type = child.nodeName;
          data.parameters = this.parseEffectParameters(child);
          break;
        case "extra":
          data.extra = this.parseEffectExtra(child);
          break;
      }
    }
    return data;
  }
  parseEffectParameters(xml) {
    const data = {};
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "emission":
        case "diffuse":
        case "specular":
        case "bump":
        case "ambient":
        case "shininess":
        case "transparency":
          data[child.nodeName] = this.parseEffectParameter(child);
          break;
        case "transparent":
          data[child.nodeName] = {
            opaque: child.hasAttribute("opaque") ? child.getAttribute("opaque") : "A_ONE",
            data: this.parseEffectParameter(child)
          };
          break;
      }
    }
    return data;
  }
  parseEffectParameter(xml) {
    const data = {};
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "color":
          data[child.nodeName] = parseFloats(child.textContent);
          break;
        case "float":
          data[child.nodeName] = parseFloat(child.textContent);
          break;
        case "texture":
          data[child.nodeName] = { id: child.getAttribute("texture"), extra: this.parseEffectParameterTexture(child) };
          break;
      }
    }
    return data;
  }
  parseEffectParameterTexture(xml) {
    const data = {
      technique: {}
    };
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "extra":
          this.parseEffectParameterTextureExtra(child, data);
          break;
      }
    }
    return data;
  }
  parseEffectParameterTextureExtra(xml, data) {
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "technique":
          this.parseEffectParameterTextureExtraTechnique(child, data);
          break;
      }
    }
  }
  parseEffectParameterTextureExtraTechnique(xml, data) {
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "repeatU":
        case "repeatV":
        case "offsetU":
        case "offsetV":
          data.technique[child.nodeName] = parseFloat(child.textContent);
          break;
        case "wrapU":
        case "wrapV":
          if (child.textContent.toUpperCase() === "TRUE") {
            data.technique[child.nodeName] = 1;
          } else if (child.textContent.toUpperCase() === "FALSE") {
            data.technique[child.nodeName] = 0;
          } else {
            data.technique[child.nodeName] = parseInt(child.textContent);
          }
          break;
        case "bump":
          data[child.nodeName] = this.parseEffectExtraTechniqueBump(child);
          break;
      }
    }
  }
  parseEffectExtra(xml) {
    const data = {};
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "technique":
          data.technique = this.parseEffectExtraTechnique(child);
          break;
      }
    }
    return data;
  }
  parseEffectExtraTechnique(xml) {
    const data = {};
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "double_sided":
          data[child.nodeName] = parseInt(child.textContent);
          break;
        case "bump":
          data[child.nodeName] = this.parseEffectExtraTechniqueBump(child);
          break;
      }
    }
    return data;
  }
  parseEffectExtraTechniqueBump(xml) {
    const data = {};
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "texture":
          data[child.nodeName] = { id: child.getAttribute("texture"), texcoord: child.getAttribute("texcoord"), extra: this.parseEffectParameterTexture(child) };
          break;
      }
    }
    return data;
  }
  // material
  parseMaterial(xml) {
    const data = {
      name: xml.getAttribute("name")
    };
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "instance_effect":
          data.url = parseId(child.getAttribute("url"));
          break;
      }
    }
    this.library.materials[xml.getAttribute("id")] = data;
  }
  // camera
  parseCamera(xml) {
    const data = {
      name: xml.getAttribute("name")
    };
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "optics":
          data.optics = this.parseCameraOptics(child);
          break;
      }
    }
    this.library.cameras[xml.getAttribute("id")] = data;
  }
  parseCameraOptics(xml) {
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      switch (child.nodeName) {
        case "technique_common":
          return this.parseCameraTechnique(child);
      }
    }
    return {};
  }
  parseCameraTechnique(xml) {
    const data = {};
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      switch (child.nodeName) {
        case "perspective":
        case "orthographic":
          data.technique = child.nodeName;
          data.parameters = this.parseCameraParameters(child);
          break;
      }
    }
    return data;
  }
  parseCameraParameters(xml) {
    const data = {};
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      switch (child.nodeName) {
        case "xfov":
        case "yfov":
        case "xmag":
        case "ymag":
        case "znear":
        case "zfar":
        case "aspect_ratio":
          data[child.nodeName] = parseFloat(child.textContent);
          break;
      }
    }
    return data;
  }
  // light
  parseLight(xml) {
    let data = {};
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "technique_common":
          data = this.parseLightTechnique(child);
          break;
      }
    }
    this.library.lights[xml.getAttribute("id")] = data;
  }
  parseLightTechnique(xml) {
    const data = {};
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "directional":
        case "point":
        case "spot":
        case "ambient":
          data.technique = child.nodeName;
          data.parameters = this.parseLightParameters(child);
          break;
      }
    }
    return data;
  }
  parseLightParameters(xml) {
    const data = {};
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "color":
          const array = parseFloats(child.textContent);
          data.color = new Color().fromArray(array);
          ColorManagement.colorSpaceToWorking(data.color, SRGBColorSpace);
          break;
        case "falloff_angle":
          data.falloffAngle = parseFloat(child.textContent);
          break;
        case "quadratic_attenuation":
          const f = parseFloat(child.textContent);
          data.distance = f ? Math.sqrt(1 / f) : 0;
          break;
      }
    }
    return data;
  }
  // geometry
  parseGeometry(xml) {
    const data = {
      name: xml.getAttribute("name"),
      sources: {},
      vertices: {},
      primitives: []
    };
    const mesh = getElementsByTagName(xml, "mesh")[0];
    if (mesh === void 0) return;
    for (let i = 0; i < mesh.childNodes.length; i++) {
      const child = mesh.childNodes[i];
      if (child.nodeType !== 1) continue;
      const id = child.getAttribute("id");
      switch (child.nodeName) {
        case "source":
          data.sources[id] = this.parseSource(child);
          break;
        case "vertices":
          data.vertices = this.parseGeometryVertices(child);
          break;
        case "polygons":
        case "lines":
        case "linestrips":
        case "polylist":
        case "triangles":
          data.primitives.push(this.parseGeometryPrimitive(child));
          break;
      }
    }
    this.library.geometries[xml.getAttribute("id")] = data;
  }
  parseSource(xml) {
    const data = {
      array: [],
      stride: 3
    };
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "float_array":
          data.array = parseFloats(child.textContent);
          break;
        case "Name_array":
          data.array = parseStrings(child.textContent);
          break;
        case "technique_common":
          const accessor = getElementsByTagName(child, "accessor")[0];
          if (accessor !== void 0) {
            data.stride = parseInt(accessor.getAttribute("stride"));
          }
          break;
      }
    }
    return data;
  }
  parseGeometryVertices(xml) {
    const data = {};
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      data[child.getAttribute("semantic")] = parseId(child.getAttribute("source"));
    }
    return data;
  }
  parseGeometryPrimitive(xml) {
    const primitive = {
      type: xml.nodeName,
      material: xml.getAttribute("material"),
      count: parseInt(xml.getAttribute("count")),
      inputs: {},
      stride: 0,
      hasUV: false
    };
    for (let i = 0, l = xml.childNodes.length; i < l; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "input":
          const id = parseId(child.getAttribute("source"));
          const semantic = child.getAttribute("semantic");
          const offset = parseInt(child.getAttribute("offset"));
          const set = parseInt(child.getAttribute("set"));
          const inputname = set > 0 ? semantic + set : semantic;
          primitive.inputs[inputname] = { id, offset };
          primitive.stride = Math.max(primitive.stride, offset + 1);
          if (semantic === "TEXCOORD") primitive.hasUV = true;
          break;
        case "vcount":
          primitive.vcount = parseInts(child.textContent);
          break;
        case "p":
          primitive.p = parseInts(child.textContent);
          break;
      }
    }
    if (primitive.type === "polygons") {
      primitive.vcount = [primitive.p.length / primitive.stride];
    }
    return primitive;
  }
  // kinematics
  parseLibraryJoint(xml) {
    this.library.joints[xml.getAttribute("id")] = this.parseKinematicsJoint(xml);
  }
  parseKinematicsModel(xml) {
    const data = {
      name: xml.getAttribute("name") || "",
      joints: {},
      links: []
    };
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "technique_common":
          this.parseKinematicsTechniqueCommon(child, data);
          break;
      }
    }
    this.library.kinematicsModels[xml.getAttribute("id")] = data;
  }
  parseKinematicsTechniqueCommon(xml, data) {
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "joint":
          data.joints[child.getAttribute("sid")] = this.parseKinematicsJoint(child);
          break;
        case "instance_joint":
          data.joints[child.getAttribute("sid")] = this.library.joints[parseId(child.getAttribute("url"))];
          break;
        case "link":
          data.links.push(this.parseKinematicsLink(child));
          break;
      }
    }
  }
  parseKinematicsJoint(xml) {
    let data;
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "prismatic":
        case "revolute":
          data = this.parseKinematicsJointParameter(child);
          break;
      }
    }
    return data;
  }
  parseKinematicsJointParameter(xml) {
    const data = {
      sid: xml.getAttribute("sid"),
      name: xml.getAttribute("name") || "",
      axis: new Vector3(),
      limits: {
        min: 0,
        max: 0
      },
      type: xml.nodeName,
      static: false,
      zeroPosition: 0,
      middlePosition: 0
    };
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "axis":
          const array = parseFloats(child.textContent);
          data.axis.fromArray(array);
          break;
        case "limits":
          const max = child.getElementsByTagName("max")[0];
          const min = child.getElementsByTagName("min")[0];
          data.limits.max = parseFloat(max.textContent);
          data.limits.min = parseFloat(min.textContent);
          break;
      }
    }
    if (data.limits.min >= data.limits.max) {
      data.static = true;
    }
    data.middlePosition = (data.limits.min + data.limits.max) / 2;
    return data;
  }
  parseKinematicsLink(xml) {
    const data = {
      sid: xml.getAttribute("sid"),
      name: xml.getAttribute("name") || "",
      attachments: [],
      transforms: []
    };
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "attachment_full":
          data.attachments.push(this.parseKinematicsAttachment(child));
          break;
        case "matrix":
        case "translate":
        case "rotate":
          data.transforms.push(this.parseKinematicsTransform(child));
          break;
      }
    }
    return data;
  }
  parseKinematicsAttachment(xml) {
    const data = {
      joint: xml.getAttribute("joint").split("/").pop(),
      transforms: [],
      links: []
    };
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "link":
          data.links.push(this.parseKinematicsLink(child));
          break;
        case "matrix":
        case "translate":
        case "rotate":
          data.transforms.push(this.parseKinematicsTransform(child));
          break;
      }
    }
    return data;
  }
  parseKinematicsTransform(xml) {
    const data = {
      type: xml.nodeName
    };
    const array = parseFloats(xml.textContent);
    switch (data.type) {
      case "matrix":
        data.obj = new Matrix4();
        data.obj.fromArray(array).transpose();
        break;
      case "translate":
        data.obj = new Vector3();
        data.obj.fromArray(array);
        break;
      case "rotate":
        data.obj = new Vector3();
        data.obj.fromArray(array);
        data.angle = MathUtils.degToRad(array[3]);
        break;
    }
    return data;
  }
  // physics
  parsePhysicsModel(xml) {
    const data = {
      name: xml.getAttribute("name") || "",
      rigidBodies: {}
    };
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "rigid_body":
          data.rigidBodies[child.getAttribute("name")] = {};
          this.parsePhysicsRigidBody(child, data.rigidBodies[child.getAttribute("name")]);
          break;
      }
    }
    this.library.physicsModels[xml.getAttribute("id")] = data;
  }
  parsePhysicsRigidBody(xml, data) {
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "technique_common":
          this.parsePhysicsTechniqueCommon(child, data);
          break;
      }
    }
  }
  parsePhysicsTechniqueCommon(xml, data) {
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "inertia":
          data.inertia = parseFloats(child.textContent);
          break;
        case "mass":
          data.mass = parseFloats(child.textContent)[0];
          break;
      }
    }
  }
  // scene
  parseKinematicsScene(xml) {
    const data = {
      bindJointAxis: []
    };
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "bind_joint_axis":
          data.bindJointAxis.push(this.parseKinematicsBindJointAxis(child));
          break;
      }
    }
    this.library.kinematicsScenes[parseId(xml.getAttribute("url"))] = data;
  }
  parseKinematicsBindJointAxis(xml) {
    const data = {
      target: xml.getAttribute("target").split("/").pop()
    };
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      switch (child.nodeName) {
        case "axis":
          const param = child.getElementsByTagName("param")[0];
          data.axis = param.textContent;
          const tmpJointIndex = data.axis.split("inst_").pop().split("axis")[0];
          data.jointIndex = tmpJointIndex.substring(0, tmpJointIndex.length - 1);
          break;
      }
    }
    return data;
  }
  // nodes
  prepareNodes(xml) {
    const elements = xml.getElementsByTagName("node");
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (element.hasAttribute("id") === false) {
        element.setAttribute("id", this.generateId());
      }
    }
  }
  parseNode(xml) {
    const matrix = new Matrix4();
    const vector = new Vector3();
    const data = {
      name: xml.getAttribute("name") || "",
      type: xml.getAttribute("type"),
      id: xml.getAttribute("id"),
      sid: xml.getAttribute("sid"),
      matrix: new Matrix4(),
      nodes: [],
      instanceCameras: [],
      instanceControllers: [],
      instanceLights: [],
      instanceGeometries: [],
      instanceNodes: [],
      transforms: {},
      transformData: {},
      transformOrder: []
    };
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      let array;
      switch (child.nodeName) {
        case "node":
          data.nodes.push(child.getAttribute("id"));
          this.parseNode(child);
          break;
        case "instance_camera":
          data.instanceCameras.push(parseId(child.getAttribute("url")));
          break;
        case "instance_controller":
          data.instanceControllers.push(this.parseNodeInstance(child));
          break;
        case "instance_light":
          data.instanceLights.push(parseId(child.getAttribute("url")));
          break;
        case "instance_geometry":
          data.instanceGeometries.push(this.parseNodeInstance(child));
          break;
        case "instance_node":
          data.instanceNodes.push(parseId(child.getAttribute("url")));
          break;
        case "matrix":
          array = parseFloats(child.textContent);
          data.matrix.multiply(matrix.fromArray(array).transpose());
          {
            const sid = child.getAttribute("sid");
            data.transforms[sid] = child.nodeName;
            data.transformData[sid] = { type: "matrix", array };
            data.transformOrder.push(sid);
          }
          break;
        case "translate":
          array = parseFloats(child.textContent);
          vector.fromArray(array);
          data.matrix.multiply(matrix.makeTranslation(vector.x, vector.y, vector.z));
          {
            const sid = child.getAttribute("sid");
            data.transforms[sid] = child.nodeName;
            data.transformData[sid] = { type: "translate", x: array[0], y: array[1], z: array[2] };
            data.transformOrder.push(sid);
          }
          break;
        case "rotate":
          array = parseFloats(child.textContent);
          {
            const angle = MathUtils.degToRad(array[3]);
            data.matrix.multiply(matrix.makeRotationAxis(vector.fromArray(array), angle));
            const sid = child.getAttribute("sid");
            data.transforms[sid] = child.nodeName;
            data.transformData[sid] = { type: "rotate", axis: [array[0], array[1], array[2]], angle: array[3] };
            data.transformOrder.push(sid);
          }
          break;
        case "scale":
          array = parseFloats(child.textContent);
          data.matrix.scale(vector.fromArray(array));
          {
            const sid = child.getAttribute("sid");
            data.transforms[sid] = child.nodeName;
            data.transformData[sid] = { type: "scale", x: array[0], y: array[1], z: array[2] };
            data.transformOrder.push(sid);
          }
          break;
      }
    }
    if (this.hasNode(data.id)) {
      console.warn("THREE.ColladaLoader: There is already a node with ID %s. Exclude current node from further processing.", data.id);
    } else {
      this.library.nodes[data.id] = data;
    }
    return data;
  }
  parseNodeInstance(xml) {
    const data = {
      id: parseId(xml.getAttribute("url")),
      materials: {},
      skeletons: []
    };
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      switch (child.nodeName) {
        case "bind_material":
          const instances = child.getElementsByTagName("instance_material");
          for (let j = 0; j < instances.length; j++) {
            const instance = instances[j];
            const symbol = instance.getAttribute("symbol");
            const target = instance.getAttribute("target");
            data.materials[symbol] = parseId(target);
          }
          break;
        case "skeleton":
          data.skeletons.push(parseId(child.textContent));
          break;
      }
    }
    return data;
  }
  // visual scenes
  parseVisualScene(xml) {
    const data = {
      name: xml.getAttribute("name"),
      children: []
    };
    this.prepareNodes(xml);
    const elements = getElementsByTagName(xml, "node");
    for (let i = 0; i < elements.length; i++) {
      data.children.push(this.parseNode(elements[i]));
    }
    this.library.visualScenes[xml.getAttribute("id")] = data;
  }
  hasNode(id) {
    return this.library.nodes[id] !== void 0;
  }
}
class ColladaComposer {
  constructor(library, collada, textureLoader, tgaLoader) {
    this.library = library;
    this.collada = collada;
    this.textureLoader = textureLoader;
    this.tgaLoader = tgaLoader;
    this.tempColor = new Color();
    this.animations = [];
    this.kinematics = {};
    this.position = new Vector3();
    this.scale = new Vector3();
    this.quaternion = new Quaternion();
    this.matrix = new Matrix4();
    this.deferredPivotAnimations = {};
    this.transformNodes = {};
  }
  compose() {
    const library = this.library;
    this.buildLibrary(library.animations, this.buildAnimation.bind(this));
    this.buildLibrary(library.clips, this.buildAnimationClip.bind(this));
    this.buildLibrary(library.controllers, this.buildController.bind(this));
    this.buildLibrary(library.images, this.buildImage.bind(this));
    this.buildLibrary(library.effects, this.buildEffect.bind(this));
    this.buildLibrary(library.materials, this.buildMaterial.bind(this));
    this.buildLibrary(library.cameras, this.buildCamera.bind(this));
    this.buildLibrary(library.lights, this.buildLight.bind(this));
    this.buildLibrary(library.geometries, this.buildGeometry.bind(this));
    this.buildLibrary(library.visualScenes, this.buildVisualScene.bind(this));
    this.setupAnimations();
    this.setupKinematics();
    const scene = this.parseScene(getElementsByTagName(this.collada, "scene")[0]);
    scene.animations = this.animations;
    return {
      scene,
      animations: this.animations,
      kinematics: this.kinematics
    };
  }
  buildLibrary(data, builder) {
    for (const name in data) {
      const object = data[name];
      object.build = builder(data[name]);
    }
  }
  getBuild(data, builder) {
    if (data.build !== void 0) return data.build;
    data.build = builder(data);
    return data.build;
  }
  isEmpty(object) {
    return Object.keys(object).length === 0;
  }
  buildAnimation(data) {
    const tracks = [];
    const channels = data.channels;
    const samplers = data.samplers;
    const sources = data.sources;
    const aggregated = this.aggregateAnimationChannels(channels, samplers, sources);
    for (const nodeId in aggregated) {
      const nodeData = this.library.nodes[nodeId];
      if (!nodeData) continue;
      const nodeChannels = aggregated[nodeId];
      if (this.hasPivotTransforms(nodeData)) {
        this.collectDeferredPivotAnimation(nodeId, nodeChannels);
      } else {
        const object3D = this.getNode(nodeId);
        let rotationTrackBuilt = false;
        for (const sid in nodeChannels) {
          const transformType = nodeData.transforms[sid];
          const transformInfo = nodeData.transformData[sid];
          const channelData = nodeChannels[sid];
          switch (transformType) {
            case "matrix":
              this.buildMatrixTracks(object3D, channelData, nodeData, tracks);
              break;
            case "translate":
              this.buildTranslateTrack(object3D, channelData, transformInfo, tracks);
              break;
            case "rotate":
              if (!rotationTrackBuilt) {
                this.buildRotateTrack(object3D, sid, channelData, transformInfo, nodeData, tracks);
                rotationTrackBuilt = true;
              }
              break;
            case "scale":
              this.buildScaleTrack(object3D, channelData, transformInfo, tracks);
              break;
          }
        }
      }
    }
    return tracks;
  }
  collectDeferredPivotAnimation(nodeId, nodeChannels) {
    if (!this.deferredPivotAnimations[nodeId]) {
      this.deferredPivotAnimations[nodeId] = {};
    }
    const deferred = this.deferredPivotAnimations[nodeId];
    for (const sid in nodeChannels) {
      if (!deferred[sid]) {
        deferred[sid] = {};
      }
      for (const member in nodeChannels[sid]) {
        deferred[sid][member] = nodeChannels[sid][member];
      }
    }
  }
  hasPivotTransforms(nodeData) {
    const pivotSids = [
      "rotatePivot",
      "rotatePivotInverse",
      "rotatePivotTranslation",
      "scalePivot",
      "scalePivotInverse",
      "scalePivotTranslation"
    ];
    for (const sid of pivotSids) {
      if (nodeData.transforms[sid] !== void 0) {
        return true;
      }
    }
    return false;
  }
  getAnimation(id) {
    return this.getBuild(this.library.animations[id], this.buildAnimation.bind(this));
  }
  aggregateAnimationChannels(channels, samplers, sources) {
    const aggregated = {};
    for (const target in channels) {
      if (!channels.hasOwnProperty(target)) continue;
      const channel = channels[target];
      const sampler = samplers[channel.sampler];
      const inputId = sampler.inputs.INPUT;
      const outputId = sampler.inputs.OUTPUT;
      const inputSource = sources[inputId];
      const outputSource = sources[outputId];
      const interpolationId = sampler.inputs.INTERPOLATION;
      const inTangentId = sampler.inputs.IN_TANGENT;
      const outTangentId = sampler.inputs.OUT_TANGENT;
      const interpolationSource = interpolationId ? sources[interpolationId] : null;
      const inTangentSource = inTangentId ? sources[inTangentId] : null;
      const outTangentSource = outTangentId ? sources[outTangentId] : null;
      const nodeId = channel.id;
      const sid = channel.sid;
      const member = channel.member || "default";
      if (!aggregated[nodeId]) aggregated[nodeId] = {};
      if (!aggregated[nodeId][sid]) aggregated[nodeId][sid] = {};
      aggregated[nodeId][sid][member] = {
        times: inputSource.array,
        values: outputSource.array,
        stride: outputSource.stride,
        arraySyntax: channel.arraySyntax,
        indices: channel.indices,
        interpolation: interpolationSource ? interpolationSource.array : null,
        inTangent: inTangentSource ? inTangentSource.array : null,
        outTangent: outTangentSource ? outTangentSource.array : null,
        inTangentStride: inTangentSource ? inTangentSource.stride : 0,
        outTangentStride: outTangentSource ? outTangentSource.stride : 0
      };
    }
    return aggregated;
  }
  buildMatrixTracks(object3D, channelData, nodeData, tracks) {
    const defaultMatrix = nodeData.matrix.clone().transpose();
    const data = {};
    for (const member in channelData) {
      const component = channelData[member];
      const times = component.times;
      const values = component.values;
      const stride = component.stride;
      for (let i = 0, il = times.length; i < il; i++) {
        const time = times[i];
        const valueOffset = i * stride;
        if (data[time] === void 0) data[time] = {};
        if (component.arraySyntax === true) {
          const value = values[valueOffset];
          const index = component.indices[0] + 4 * component.indices[1];
          data[time][index] = value;
        } else {
          for (let j = 0; j < stride; j++) {
            data[time][j] = values[valueOffset + j];
          }
        }
      }
    }
    const keyframes = this.prepareAnimationData(data, defaultMatrix);
    const animation = { name: object3D.uuid, keyframes };
    this.createKeyframeTracks(animation, tracks);
  }
  buildTranslateTrack(object3D, channelData, transformInfo, tracks) {
    if (channelData.default && channelData.default.stride === 3) {
      const data = channelData.default;
      const times2 = Array.from(data.times);
      const values2 = Array.from(data.values);
      const track2 = new VectorKeyframeTrack(
        object3D.uuid + ".position",
        times2,
        values2
      );
      const interpolationInfo2 = this.getInterpolationInfo(channelData);
      this.applyInterpolation(track2, interpolationInfo2, channelData);
      tracks.push(track2);
      return;
    }
    const times = this.getTimesForAllAxes(channelData);
    if (times.length === 0) return;
    const values = [];
    const interpolationInfo = this.getInterpolationInfo(channelData);
    for (let i = 0; i < times.length; i++) {
      const time = times[i];
      const x = this.getValueAtTime(channelData.X, time, transformInfo.x);
      const y = this.getValueAtTime(channelData.Y, time, transformInfo.y);
      const z = this.getValueAtTime(channelData.Z, time, transformInfo.z);
      values.push(x, y, z);
    }
    const track = new VectorKeyframeTrack(
      object3D.uuid + ".position",
      times,
      values
    );
    this.applyInterpolation(track, interpolationInfo);
    tracks.push(track);
  }
  buildRotateTrack(object3D, sid, channelData, transformInfo, nodeData, tracks) {
    const angleData = channelData.ANGLE || channelData.default;
    if (!angleData) return;
    const times = Array.from(angleData.times);
    if (times.length === 0) return;
    const rotations = [];
    for (const transformSid of nodeData.transformOrder) {
      const transformType = nodeData.transforms[transformSid];
      if (transformType === "rotate") {
        const info = nodeData.transformData[transformSid];
        rotations.push({
          sid: transformSid,
          axis: new Vector3(info.axis[0], info.axis[1], info.axis[2]),
          defaultAngle: info.angle
        });
      }
    }
    const quaternion = new Quaternion();
    const prevQuaternion = new Quaternion();
    const tempQuat = new Quaternion();
    const values = [];
    const interpolationInfo = this.getInterpolationInfo(channelData);
    for (let i = 0; i < times.length; i++) {
      const time = times[i];
      quaternion.identity();
      for (const rotation of rotations) {
        let angleDegrees;
        if (rotation.sid === sid) {
          angleDegrees = this.getValueAtTime(angleData, time, rotation.defaultAngle);
        } else {
          angleDegrees = rotation.defaultAngle;
        }
        const angleRadians = MathUtils.degToRad(angleDegrees);
        tempQuat.setFromAxisAngle(rotation.axis, angleRadians);
        quaternion.multiply(tempQuat);
      }
      if (i > 0 && prevQuaternion.dot(quaternion) < 0) {
        quaternion.x = -quaternion.x;
        quaternion.y = -quaternion.y;
        quaternion.z = -quaternion.z;
        quaternion.w = -quaternion.w;
      }
      prevQuaternion.copy(quaternion);
      values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    }
    const track = new QuaternionKeyframeTrack(
      object3D.uuid + ".quaternion",
      times,
      values
    );
    this.applyInterpolation(track, interpolationInfo);
    tracks.push(track);
  }
  buildScaleTrack(object3D, channelData, transformInfo, tracks) {
    if (channelData.default && channelData.default.stride === 3) {
      const data = channelData.default;
      const times2 = Array.from(data.times);
      const values2 = Array.from(data.values);
      const track2 = new VectorKeyframeTrack(
        object3D.uuid + ".scale",
        times2,
        values2
      );
      const interpolationInfo2 = this.getInterpolationInfo(channelData);
      this.applyInterpolation(track2, interpolationInfo2, channelData);
      tracks.push(track2);
      return;
    }
    const times = this.getTimesForAllAxes(channelData);
    if (times.length === 0) return;
    const values = [];
    const interpolationInfo = this.getInterpolationInfo(channelData);
    for (let i = 0; i < times.length; i++) {
      const time = times[i];
      const x = this.getValueAtTime(channelData.X, time, transformInfo.x);
      const y = this.getValueAtTime(channelData.Y, time, transformInfo.y);
      const z = this.getValueAtTime(channelData.Z, time, transformInfo.z);
      values.push(x, y, z);
    }
    const track = new VectorKeyframeTrack(
      object3D.uuid + ".scale",
      times,
      values
    );
    this.applyInterpolation(track, interpolationInfo);
    tracks.push(track);
  }
  getTimesForAllAxes(channelData) {
    let times = [];
    if (channelData.X) times = times.concat(Array.from(channelData.X.times));
    if (channelData.Y) times = times.concat(Array.from(channelData.Y.times));
    if (channelData.Z) times = times.concat(Array.from(channelData.Z.times));
    if (channelData.ANGLE) times = times.concat(Array.from(channelData.ANGLE.times));
    if (channelData.default) times = times.concat(Array.from(channelData.default.times));
    times = [...new Set(times)].sort((a, b) => a - b);
    return times;
  }
  getValueAtTime(componentData, time, defaultValue) {
    if (!componentData) return defaultValue;
    const times = componentData.times;
    const values = componentData.values;
    const interpolation = componentData.interpolation;
    for (let i = 0; i < times.length; i++) {
      if (times[i] === time) {
        return values[i];
      }
      if (times[i] > time) {
        if (i === 0) {
          return values[0];
        }
        const i0 = i - 1;
        const i1 = i;
        const t0 = times[i0];
        const t1 = times[i1];
        const v0 = values[i0];
        const v1 = values[i1];
        const interp = interpolation ? interpolation[i0] : "LINEAR";
        if (interp === "STEP") {
          return v0;
        } else if (interp === "BEZIER" && componentData.inTangent && componentData.outTangent) {
          return this.evaluateBezierComponent(componentData, i0, i1, t0, t1, time);
        } else {
          const t = (time - t0) / (t1 - t0);
          return v0 + t * (v1 - v0);
        }
      }
    }
    return values[values.length - 1];
  }
  evaluateBezierComponent(componentData, i0, i1, t0, t1, time) {
    const values = componentData.values;
    const inTangent = componentData.inTangent;
    const outTangent = componentData.outTangent;
    const tangentStride = componentData.inTangentStride || 1;
    const v0 = values[i0];
    const v1 = values[i1];
    let c0x, c0y, c1x, c1y;
    if (tangentStride === 2) {
      c0x = outTangent[i0 * 2];
      c0y = outTangent[i0 * 2 + 1];
      c1x = inTangent[i1 * 2];
      c1y = inTangent[i1 * 2 + 1];
    } else {
      c0x = t0 + (t1 - t0) / 3;
      c0y = outTangent[i0];
      c1x = t1 - (t1 - t0) / 3;
      c1y = inTangent[i1];
    }
    let s = (time - t0) / (t1 - t0);
    for (let iter = 0; iter < 8; iter++) {
      const s22 = s * s;
      const s32 = s22 * s;
      const oneMinusS4 = 1 - s;
      const oneMinusS22 = oneMinusS4 * oneMinusS4;
      const oneMinusS32 = oneMinusS22 * oneMinusS4;
      const bx = oneMinusS32 * t0 + 3 * oneMinusS22 * s * c0x + 3 * oneMinusS4 * s22 * c1x + s32 * t1;
      const dbx = 3 * oneMinusS22 * (c0x - t0) + 6 * oneMinusS4 * s * (c1x - c0x) + 3 * s22 * (t1 - c1x);
      if (Math.abs(dbx) < 1e-10) break;
      const error = bx - time;
      if (Math.abs(error) < 1e-10) break;
      s = s - error / dbx;
      s = Math.max(0, Math.min(1, s));
    }
    const s2 = s * s;
    const s3 = s2 * s;
    const oneMinusS = 1 - s;
    const oneMinusS2 = oneMinusS * oneMinusS;
    const oneMinusS3 = oneMinusS2 * oneMinusS;
    return oneMinusS3 * v0 + 3 * oneMinusS2 * s * c0y + 3 * oneMinusS * s2 * c1y + s3 * v1;
  }
  getInterpolationInfo(channelData) {
    const components = ["X", "Y", "Z", "ANGLE", "default"];
    let interpolationType = null;
    let isUniform = true;
    for (const comp of components) {
      const data = channelData[comp];
      if (!data || !data.interpolation) continue;
      const interpArray = data.interpolation;
      for (let i = 0; i < interpArray.length; i++) {
        const interp = interpArray[i];
        if (interpolationType === null) {
          interpolationType = interp;
        } else if (interp !== interpolationType) {
          isUniform = false;
        }
      }
    }
    return {
      type: interpolationType || "LINEAR",
      uniform: isUniform
    };
  }
  applyInterpolation(track, interpolationInfo, channelData = null) {
    if (interpolationInfo.type === "STEP" && interpolationInfo.uniform) {
      track.setInterpolation(InterpolateDiscrete);
    } else if (interpolationInfo.type === "BEZIER" && interpolationInfo.uniform && channelData) {
      const data = channelData.default;
      if (data && data.inTangent && data.outTangent) {
        track.setInterpolation(InterpolateBezier);
        track.settings = {
          inTangents: new Float32Array(data.inTangent),
          outTangents: new Float32Array(data.outTangent)
        };
      }
    }
  }
  prepareAnimationData(data, defaultMatrix) {
    const keyframes = [];
    for (const time in data) {
      keyframes.push({ time: parseFloat(time), value: data[time] });
    }
    keyframes.sort((a, b) => a.time - b.time);
    for (let i = 0; i < 16; i++) {
      this.transformAnimationData(keyframes, i, defaultMatrix.elements[i]);
    }
    return keyframes;
  }
  createKeyframeTracks(animation, tracks) {
    const keyframes = animation.keyframes;
    const name = animation.name;
    const times = [];
    const positionData = [];
    const quaternionData = [];
    const scaleData = [];
    const position = this.position;
    const quaternion = this.quaternion;
    const scale = this.scale;
    const matrix = this.matrix;
    for (let i = 0, l = keyframes.length; i < l; i++) {
      const keyframe = keyframes[i];
      const time = keyframe.time;
      const value = keyframe.value;
      matrix.fromArray(value).transpose();
      matrix.decompose(position, quaternion, scale);
      times.push(time);
      positionData.push(position.x, position.y, position.z);
      quaternionData.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
      scaleData.push(scale.x, scale.y, scale.z);
    }
    if (positionData.length > 0) tracks.push(new VectorKeyframeTrack(name + ".position", times, positionData));
    if (quaternionData.length > 0) tracks.push(new QuaternionKeyframeTrack(name + ".quaternion", times, quaternionData));
    if (scaleData.length > 0) tracks.push(new VectorKeyframeTrack(name + ".scale", times, scaleData));
    return tracks;
  }
  transformAnimationData(keyframes, property, defaultValue) {
    let keyframe;
    let empty = true;
    let i, l;
    for (i = 0, l = keyframes.length; i < l; i++) {
      keyframe = keyframes[i];
      if (keyframe.value[property] === void 0) {
        keyframe.value[property] = null;
      } else {
        empty = false;
      }
    }
    if (empty === true) {
      for (i = 0, l = keyframes.length; i < l; i++) {
        keyframe = keyframes[i];
        keyframe.value[property] = defaultValue;
      }
    } else {
      this.createMissingKeyframes(keyframes, property);
    }
  }
  createMissingKeyframes(keyframes, property) {
    let prev, next;
    for (let i = 0, l = keyframes.length; i < l; i++) {
      const keyframe = keyframes[i];
      if (keyframe.value[property] === null) {
        prev = this.getPrev(keyframes, i, property);
        next = this.getNext(keyframes, i, property);
        if (prev === null) {
          keyframe.value[property] = next.value[property];
          continue;
        }
        if (next === null) {
          keyframe.value[property] = prev.value[property];
          continue;
        }
        this.interpolate(keyframe, prev, next, property);
      }
    }
  }
  getPrev(keyframes, i, property) {
    while (i >= 0) {
      const keyframe = keyframes[i];
      if (keyframe.value[property] !== null) return keyframe;
      i--;
    }
    return null;
  }
  getNext(keyframes, i, property) {
    while (i < keyframes.length) {
      const keyframe = keyframes[i];
      if (keyframe.value[property] !== null) return keyframe;
      i++;
    }
    return null;
  }
  interpolate(key, prev, next, property) {
    if (next.time - prev.time === 0) {
      key.value[property] = prev.value[property];
      return;
    }
    key.value[property] = (key.time - prev.time) * (next.value[property] - prev.value[property]) / (next.time - prev.time) + prev.value[property];
  }
  buildAnimationClip(data) {
    const tracks = [];
    const name = data.name;
    const duration = data.end - data.start || -1;
    const animations = data.animations;
    for (let i = 0, il = animations.length; i < il; i++) {
      const animationTracks = this.getAnimation(animations[i]);
      for (let j = 0, jl = animationTracks.length; j < jl; j++) {
        tracks.push(animationTracks[j]);
      }
    }
    return new AnimationClip(name, duration, tracks);
  }
  getAnimationClip(id) {
    return this.getBuild(this.library.clips[id], this.buildAnimationClip.bind(this));
  }
  buildController(data) {
    const build = {
      id: data.id
    };
    const geometry = this.library.geometries[build.id];
    if (data.skin !== void 0) {
      build.skin = this.buildSkin(data.skin);
      geometry.sources.skinIndices = build.skin.indices;
      geometry.sources.skinWeights = build.skin.weights;
    }
    return build;
  }
  buildSkin(data) {
    const BONE_LIMIT = 4;
    const build = {
      joints: [],
      // this must be an array to preserve the joint order
      indices: {
        array: [],
        stride: BONE_LIMIT
      },
      weights: {
        array: [],
        stride: BONE_LIMIT
      }
    };
    const sources = data.sources;
    const vertexWeights = data.vertexWeights;
    const vcount = vertexWeights.vcount;
    const v = vertexWeights.v;
    const jointOffset = vertexWeights.inputs.JOINT.offset;
    const weightOffset = vertexWeights.inputs.WEIGHT.offset;
    const jointSource = data.sources[data.joints.inputs.JOINT];
    const inverseSource = data.sources[data.joints.inputs.INV_BIND_MATRIX];
    const weights = sources[vertexWeights.inputs.WEIGHT.id].array;
    let stride = 0;
    let i, j, l;
    for (i = 0, l = vcount.length; i < l; i++) {
      const jointCount = vcount[i];
      const vertexSkinData = [];
      for (j = 0; j < jointCount; j++) {
        const skinIndex = v[stride + jointOffset];
        const weightId = v[stride + weightOffset];
        const skinWeight = weights[weightId];
        vertexSkinData.push({ index: skinIndex, weight: skinWeight });
        stride += 2;
      }
      vertexSkinData.sort(descending);
      for (j = 0; j < BONE_LIMIT; j++) {
        const d = vertexSkinData[j];
        if (d !== void 0) {
          build.indices.array.push(d.index);
          build.weights.array.push(d.weight);
        } else {
          build.indices.array.push(0);
          build.weights.array.push(0);
        }
      }
    }
    if (data.bindShapeMatrix) {
      build.bindMatrix = new Matrix4().fromArray(data.bindShapeMatrix).transpose();
    } else {
      build.bindMatrix = new Matrix4().identity();
    }
    for (i = 0, l = jointSource.array.length; i < l; i++) {
      const name = jointSource.array[i];
      const boneInverse = new Matrix4().fromArray(inverseSource.array, i * inverseSource.stride).transpose();
      build.joints.push({ name, boneInverse });
    }
    return build;
    function descending(a, b) {
      return b.weight - a.weight;
    }
  }
  getController(id) {
    return this.getBuild(this.library.controllers[id], this.buildController.bind(this));
  }
  buildImage(data) {
    if (data.build !== void 0) return data.build;
    return data.init_from;
  }
  getImage(id) {
    const data = this.library.images[id];
    if (data !== void 0) {
      return this.getBuild(data, this.buildImage.bind(this));
    }
    console.warn("THREE.ColladaLoader: Couldn't find image with ID:", id);
    return null;
  }
  buildEffect(data) {
    return data;
  }
  getEffect(id) {
    return this.getBuild(this.library.effects[id], this.buildEffect.bind(this));
  }
  getTextureLoader(image) {
    let loader;
    let extension = image.slice((image.lastIndexOf(".") - 1 >>> 0) + 2);
    extension = extension.toLowerCase();
    switch (extension) {
      case "tga":
        loader = this.tgaLoader;
        break;
      default:
        loader = this.textureLoader;
    }
    return loader;
  }
  buildMaterial(data) {
    const effect = this.getEffect(data.url);
    const technique = effect.profile.technique;
    let material;
    switch (technique.type) {
      case "phong":
      case "blinn":
        material = new MeshPhongMaterial();
        break;
      case "lambert":
        material = new MeshLambertMaterial();
        break;
      default:
        material = new MeshBasicMaterial();
        break;
    }
    material.name = data.name || "";
    const self = this;
    function getTexture(textureObject, colorSpace = null) {
      const sampler = effect.profile.samplers[textureObject.id];
      let image = null;
      if (sampler !== void 0) {
        const surface = effect.profile.surfaces[sampler.source];
        image = self.getImage(surface.init_from);
      } else {
        console.warn("THREE.ColladaLoader: Undefined sampler. Access image directly (see #12530).");
        image = self.getImage(textureObject.id);
      }
      if (image !== null) {
        const loader = self.getTextureLoader(image);
        if (loader !== void 0) {
          const texture = loader.load(image);
          const extra = textureObject.extra;
          if (extra !== void 0 && extra.technique !== void 0 && self.isEmpty(extra.technique) === false) {
            const technique2 = extra.technique;
            texture.wrapS = technique2.wrapU ? RepeatWrapping : ClampToEdgeWrapping;
            texture.wrapT = technique2.wrapV ? RepeatWrapping : ClampToEdgeWrapping;
            texture.offset.set(technique2.offsetU || 0, technique2.offsetV || 0);
            texture.repeat.set(technique2.repeatU || 1, technique2.repeatV || 1);
          } else {
            texture.wrapS = RepeatWrapping;
            texture.wrapT = RepeatWrapping;
          }
          if (colorSpace !== null) {
            texture.colorSpace = colorSpace;
          }
          return texture;
        } else {
          console.warn("THREE.ColladaLoader: Loader for texture %s not found.", image);
          return null;
        }
      } else {
        console.warn("THREE.ColladaLoader: Couldn't create texture with ID:", textureObject.id);
        return null;
      }
    }
    const parameters = technique.parameters;
    for (const key in parameters) {
      const parameter = parameters[key];
      switch (key) {
        case "diffuse":
          if (parameter.color) material.color.fromArray(parameter.color);
          if (parameter.texture) material.map = getTexture(parameter.texture, SRGBColorSpace);
          break;
        case "specular":
          if (parameter.color && material.specular) material.specular.fromArray(parameter.color);
          if (parameter.texture) material.specularMap = getTexture(parameter.texture);
          break;
        case "bump":
          if (parameter.texture) material.normalMap = getTexture(parameter.texture);
          break;
        case "ambient":
          if (parameter.texture) material.lightMap = getTexture(parameter.texture, SRGBColorSpace);
          break;
        case "shininess":
          if (parameter.float && material.shininess) material.shininess = parameter.float;
          break;
        case "emission":
          if (parameter.color && material.emissive) material.emissive.fromArray(parameter.color);
          if (parameter.texture) material.emissiveMap = getTexture(parameter.texture, SRGBColorSpace);
          break;
      }
    }
    ColorManagement.colorSpaceToWorking(material.color, SRGBColorSpace);
    if (material.specular) ColorManagement.colorSpaceToWorking(material.specular, SRGBColorSpace);
    if (material.emissive) ColorManagement.colorSpaceToWorking(material.emissive, SRGBColorSpace);
    let transparent = parameters["transparent"];
    let transparency = parameters["transparency"];
    if (transparency === void 0 && transparent) {
      transparency = {
        float: 1
      };
    }
    if (transparent === void 0 && transparency) {
      transparent = {
        opaque: "A_ONE",
        data: {
          color: [1, 1, 1, 1]
        }
      };
    }
    if (transparent && transparency) {
      if (transparent.data.texture) {
        material.transparent = true;
      } else {
        const color = transparent.data.color;
        switch (transparent.opaque) {
          case "A_ONE":
            material.opacity = color[3] * transparency.float;
            break;
          case "RGB_ZERO":
            material.opacity = 1 - color[0] * transparency.float;
            break;
          case "A_ZERO":
            material.opacity = 1 - color[3] * transparency.float;
            break;
          case "RGB_ONE":
            material.opacity = color[0] * transparency.float;
            break;
          default:
            console.warn('THREE.ColladaLoader: Invalid opaque type "%s" of transparent tag.', transparent.opaque);
        }
        if (material.opacity < 1) material.transparent = true;
      }
    }
    if (technique.extra !== void 0 && technique.extra.technique !== void 0) {
      const techniques = technique.extra.technique;
      for (const k in techniques) {
        const v = techniques[k];
        switch (k) {
          case "double_sided":
            material.side = v === 1 ? DoubleSide : FrontSide;
            break;
          case "bump":
            material.normalMap = getTexture(v.texture);
            material.normalScale = new Vector2(1, 1);
            break;
        }
      }
    }
    return material;
  }
  getMaterial(id) {
    return this.getBuild(this.library.materials[id], this.buildMaterial.bind(this));
  }
  buildCamera(data) {
    let camera;
    switch (data.optics.technique) {
      case "perspective":
        camera = new PerspectiveCamera(
          data.optics.parameters.yfov,
          data.optics.parameters.aspect_ratio,
          data.optics.parameters.znear,
          data.optics.parameters.zfar
        );
        break;
      case "orthographic":
        let ymag = data.optics.parameters.ymag;
        let xmag = data.optics.parameters.xmag;
        const aspectRatio = data.optics.parameters.aspect_ratio;
        xmag = xmag === void 0 ? ymag * aspectRatio : xmag;
        ymag = ymag === void 0 ? xmag / aspectRatio : ymag;
        xmag *= 0.5;
        ymag *= 0.5;
        camera = new OrthographicCamera(
          -xmag,
          xmag,
          ymag,
          -ymag,
          // left, right, top, bottom
          data.optics.parameters.znear,
          data.optics.parameters.zfar
        );
        break;
      default:
        camera = new PerspectiveCamera();
        break;
    }
    camera.name = data.name || "";
    return camera;
  }
  getCamera(id) {
    const data = this.library.cameras[id];
    if (data !== void 0) {
      return this.getBuild(data, this.buildCamera.bind(this));
    }
    console.warn("THREE.ColladaLoader: Couldn't find camera with ID:", id);
    return null;
  }
  buildLight(data) {
    let light;
    switch (data.technique) {
      case "directional":
        light = new DirectionalLight();
        break;
      case "point":
        light = new PointLight();
        break;
      case "spot":
        light = new SpotLight();
        break;
      case "ambient":
        light = new AmbientLight();
        break;
    }
    if (data.parameters.color) light.color.copy(data.parameters.color);
    if (data.parameters.distance) light.distance = data.parameters.distance;
    if (data.parameters.falloffAngle) light.angle = MathUtils.degToRad(data.parameters.falloffAngle);
    return light;
  }
  getLight(id) {
    const data = this.library.lights[id];
    if (data !== void 0) {
      return this.getBuild(data, this.buildLight.bind(this));
    }
    console.warn("THREE.ColladaLoader: Couldn't find light with ID:", id);
    return null;
  }
  groupPrimitives(primitives) {
    const build = {};
    for (let i = 0; i < primitives.length; i++) {
      const primitive = primitives[i];
      if (build[primitive.type] === void 0) build[primitive.type] = [];
      build[primitive.type].push(primitive);
    }
    return build;
  }
  checkUVCoordinates(primitives) {
    let count = 0;
    for (let i = 0, l = primitives.length; i < l; i++) {
      const primitive = primitives[i];
      if (primitive.hasUV === true) {
        count++;
      }
    }
    if (count > 0 && count < primitives.length) {
      primitives.uvsNeedsFix = true;
    }
  }
  buildGeometry(data) {
    const build = {};
    const sources = data.sources;
    const vertices = data.vertices;
    const primitives = data.primitives;
    if (primitives.length === 0) return {};
    const groupedPrimitives = this.groupPrimitives(primitives);
    for (const type in groupedPrimitives) {
      const primitiveType = groupedPrimitives[type];
      this.checkUVCoordinates(primitiveType);
      build[type] = this.buildGeometryType(primitiveType, sources, vertices);
    }
    return build;
  }
  buildGeometryType(primitives, sources, vertices) {
    const build = {};
    const position = { array: [], stride: 0 };
    const normal = { array: [], stride: 0 };
    const uv = { array: [], stride: 0 };
    const uv1 = { array: [], stride: 0 };
    const color = { array: [], stride: 0 };
    const skinIndex = { array: [], stride: 4 };
    const skinWeight = { array: [], stride: 4 };
    const geometry = new BufferGeometry();
    const materialKeys = [];
    let start = 0;
    for (let p = 0; p < primitives.length; p++) {
      const primitive = primitives[p];
      const inputs = primitive.inputs;
      let count = 0;
      switch (primitive.type) {
        case "lines":
        case "linestrips":
          count = primitive.count * 2;
          break;
        case "triangles":
          count = primitive.count * 3;
          break;
        case "polygons":
        case "polylist":
          for (let g = 0; g < primitive.count; g++) {
            const vc = primitive.vcount[g];
            switch (vc) {
              case 3:
                count += 3;
                break;
              case 4:
                count += 6;
                break;
              default:
                count += (vc - 2) * 3;
                break;
            }
          }
          break;
        default:
          console.warn("THREE.ColladaLoader: Unknown primitive type:", primitive.type);
      }
      geometry.addGroup(start, count, p);
      start += count;
      if (primitive.material) {
        materialKeys.push(primitive.material);
      }
      for (const name in inputs) {
        const input = inputs[name];
        switch (name) {
          case "VERTEX":
            for (const key in vertices) {
              const id = vertices[key];
              switch (key) {
                case "POSITION":
                  const prevLength = position.array.length;
                  this.buildGeometryData(primitive, sources[id], input.offset, position.array);
                  position.stride = sources[id].stride;
                  if (sources.skinWeights && sources.skinIndices) {
                    this.buildGeometryData(primitive, sources.skinIndices, input.offset, skinIndex.array);
                    this.buildGeometryData(primitive, sources.skinWeights, input.offset, skinWeight.array);
                  }
                  if (primitive.hasUV === false && primitives.uvsNeedsFix === true) {
                    const count2 = (position.array.length - prevLength) / position.stride;
                    for (let i = 0; i < count2; i++) {
                      uv.array.push(0, 0);
                    }
                  }
                  break;
                case "NORMAL":
                  this.buildGeometryData(primitive, sources[id], input.offset, normal.array);
                  normal.stride = sources[id].stride;
                  break;
                case "COLOR":
                  this.buildGeometryData(primitive, sources[id], input.offset, color.array);
                  color.stride = sources[id].stride;
                  break;
                case "TEXCOORD":
                  this.buildGeometryData(primitive, sources[id], input.offset, uv.array);
                  uv.stride = sources[id].stride;
                  break;
                case "TEXCOORD1":
                  this.buildGeometryData(primitive, sources[id], input.offset, uv1.array);
                  uv.stride = sources[id].stride;
                  break;
                default:
                  console.warn('THREE.ColladaLoader: Semantic "%s" not handled in geometry build process.', key);
              }
            }
            break;
          case "NORMAL":
            this.buildGeometryData(primitive, sources[input.id], input.offset, normal.array);
            normal.stride = sources[input.id].stride;
            break;
          case "COLOR":
            this.buildGeometryData(primitive, sources[input.id], input.offset, color.array, true);
            color.stride = sources[input.id].stride;
            break;
          case "TEXCOORD":
            this.buildGeometryData(primitive, sources[input.id], input.offset, uv.array);
            uv.stride = sources[input.id].stride;
            break;
          case "TEXCOORD1":
            this.buildGeometryData(primitive, sources[input.id], input.offset, uv1.array);
            uv1.stride = sources[input.id].stride;
            break;
        }
      }
    }
    if (position.array.length > 0) geometry.setAttribute("position", new Float32BufferAttribute(position.array, position.stride));
    if (normal.array.length > 0) geometry.setAttribute("normal", new Float32BufferAttribute(normal.array, normal.stride));
    if (color.array.length > 0) geometry.setAttribute("color", new Float32BufferAttribute(color.array, color.stride));
    if (uv.array.length > 0) geometry.setAttribute("uv", new Float32BufferAttribute(uv.array, uv.stride));
    if (uv1.array.length > 0) geometry.setAttribute("uv1", new Float32BufferAttribute(uv1.array, uv1.stride));
    if (skinIndex.array.length > 0) geometry.setAttribute("skinIndex", new Float32BufferAttribute(skinIndex.array, skinIndex.stride));
    if (skinWeight.array.length > 0) geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeight.array, skinWeight.stride));
    build.data = geometry;
    build.type = primitives[0].type;
    build.materialKeys = materialKeys;
    return build;
  }
  buildGeometryData(primitive, source, offset, array, isColor = false) {
    const indices = primitive.p;
    const stride = primitive.stride;
    const vcount = primitive.vcount;
    const tempColor = this.tempColor;
    function pushVector(i) {
      let index = indices[i + offset] * sourceStride;
      const length = index + sourceStride;
      for (; index < length; index++) {
        array.push(sourceArray[index]);
      }
      if (isColor) {
        const startIndex = array.length - sourceStride - 1;
        tempColor.setRGB(
          array[startIndex + 0],
          array[startIndex + 1],
          array[startIndex + 2],
          SRGBColorSpace
        );
        array[startIndex + 0] = tempColor.r;
        array[startIndex + 1] = tempColor.g;
        array[startIndex + 2] = tempColor.b;
      }
    }
    const sourceArray = source.array;
    const sourceStride = source.stride;
    if (primitive.vcount !== void 0) {
      let index = 0;
      for (let i = 0, l = vcount.length; i < l; i++) {
        const count = vcount[i];
        if (count === 4) {
          const a = index + stride * 0;
          const b = index + stride * 1;
          const c = index + stride * 2;
          const d = index + stride * 3;
          pushVector(a);
          pushVector(b);
          pushVector(d);
          pushVector(b);
          pushVector(c);
          pushVector(d);
        } else if (count === 3) {
          const a = index + stride * 0;
          const b = index + stride * 1;
          const c = index + stride * 2;
          pushVector(a);
          pushVector(b);
          pushVector(c);
        } else if (count > 4) {
          const vertices = [];
          for (let k = 0; k < count; k++) {
            const a = index + stride * k;
            const positionIndex = indices[a] * sourceStride;
            const x = sourceArray[positionIndex];
            const y = sourceArray[positionIndex + 1];
            const z = sourceArray[positionIndex + 2];
            vertices.push(new Vector3(x, y, z));
          }
          const normal = new Vector3();
          const _triangle = new Triangle();
          _triangle.a = vertices[0];
          _triangle.b = vertices[1];
          _triangle.c = vertices[2];
          _triangle.getNormal(normal);
          const vertices2D = [];
          if (Math.abs(normal.x) > Math.abs(normal.y) && Math.abs(normal.x) > Math.abs(normal.z)) {
            for (let k = 0; k < count; k++) {
              vertices2D.push(new Vector2(vertices[k].y, vertices[k].z));
            }
          } else if (Math.abs(normal.y) > Math.abs(normal.z)) {
            for (let k = 0; k < count; k++) {
              vertices2D.push(new Vector2(vertices[k].x, vertices[k].z));
            }
          } else {
            for (let k = 0; k < count; k++) {
              vertices2D.push(new Vector2(vertices[k].x, vertices[k].y));
            }
          }
          const isClockWise = ShapeUtils.isClockWise(vertices2D);
          if (isClockWise === true) {
            vertices2D.reverse();
          }
          const faces = ShapeUtils.triangulateShape(vertices2D, []);
          for (let k = 0; k < faces.length; k++) {
            const face = faces[k];
            let i0, i1, i2;
            if (isClockWise === false) {
              i0 = face[0];
              i1 = face[1];
              i2 = face[2];
            } else {
              i0 = count - 1 - face[0];
              i1 = count - 1 - face[2];
              i2 = count - 1 - face[1];
            }
            const a = index + stride * i0;
            const b = index + stride * i1;
            const c = index + stride * i2;
            pushVector(a);
            pushVector(b);
            pushVector(c);
          }
        }
        index += stride * count;
      }
    } else {
      for (let i = 0, l = indices.length; i < l; i += stride) {
        pushVector(i);
      }
    }
  }
  getGeometry(id) {
    return this.getBuild(this.library.geometries[id], this.buildGeometry.bind(this));
  }
  buildKinematicsModel(data) {
    if (data.build !== void 0) return data.build;
    return data;
  }
  getKinematicsModel(id) {
    return this.getBuild(this.library.kinematicsModels[id], this.buildKinematicsModel.bind(this));
  }
  buildKinematicsScene(data) {
    if (data.build !== void 0) return data.build;
    return data;
  }
  getKinematicsScene(id) {
    return this.getBuild(this.library.kinematicsScenes[id], this.buildKinematicsScene.bind(this));
  }
  setupKinematics() {
    const kinematicsModelId = Object.keys(this.library.kinematicsModels)[0];
    const kinematicsSceneId = Object.keys(this.library.kinematicsScenes)[0];
    const visualSceneId = Object.keys(this.library.visualScenes)[0];
    if (kinematicsModelId === void 0 || kinematicsSceneId === void 0) return;
    const kinematicsModel = this.getKinematicsModel(kinematicsModelId);
    const kinematicsScene = this.getKinematicsScene(kinematicsSceneId);
    const visualScene = this.getVisualScene(visualSceneId);
    const bindJointAxis = kinematicsScene.bindJointAxis;
    const jointMap = {};
    const collada = this.collada;
    const self = this;
    for (let i = 0, l = bindJointAxis.length; i < l; i++) {
      const axis = bindJointAxis[i];
      const targetElement = collada.querySelector('[sid="' + axis.target + '"]');
      if (targetElement) {
        const parentVisualElement = targetElement.parentElement;
        connect(axis.jointIndex, parentVisualElement);
      }
    }
    function connect(jointIndex, visualElement) {
      const visualElementName = visualElement.getAttribute("name");
      const joint = kinematicsModel.joints[jointIndex];
      const transforms = self.buildTransformList(visualElement);
      visualScene.traverse(function(object) {
        if (object.name === visualElementName) {
          jointMap[jointIndex] = {
            object,
            transforms,
            joint,
            position: joint.zeroPosition
          };
        }
      });
    }
    const m0 = new Matrix4();
    const matrix = this.matrix;
    this.kinematics = {
      joints: kinematicsModel && kinematicsModel.joints,
      getJointValue: function(jointIndex) {
        const jointData = jointMap[jointIndex];
        if (jointData) {
          return jointData.position;
        } else {
          console.warn("THREE.ColladaLoader: Joint " + jointIndex + " doesn't exist.");
        }
      },
      setJointValue: function(jointIndex, value) {
        const jointData = jointMap[jointIndex];
        if (jointData) {
          const joint = jointData.joint;
          if (value > joint.limits.max || value < joint.limits.min) {
            console.warn("THREE.ColladaLoader: Joint " + jointIndex + " value " + value + " outside of limits (min: " + joint.limits.min + ", max: " + joint.limits.max + ").");
          } else if (joint.static) {
            console.warn("THREE.ColladaLoader: Joint " + jointIndex + " is static.");
          } else {
            const object = jointData.object;
            const axis = joint.axis;
            const transforms = jointData.transforms;
            matrix.identity();
            for (let i = 0; i < transforms.length; i++) {
              const transform = transforms[i];
              if (transform.sid && transform.sid.indexOf(jointIndex) !== -1) {
                switch (joint.type) {
                  case "revolute":
                    matrix.multiply(m0.makeRotationAxis(axis, MathUtils.degToRad(value)));
                    break;
                  case "prismatic":
                    matrix.multiply(m0.makeTranslation(axis.x * value, axis.y * value, axis.z * value));
                    break;
                  default:
                    console.warn("THREE.ColladaLoader: Unknown joint type: " + joint.type);
                    break;
                }
              } else {
                switch (transform.type) {
                  case "matrix":
                    matrix.multiply(transform.obj);
                    break;
                  case "translate":
                    matrix.multiply(m0.makeTranslation(transform.obj.x, transform.obj.y, transform.obj.z));
                    break;
                  case "scale":
                    matrix.scale(transform.obj);
                    break;
                  case "rotate":
                    matrix.multiply(m0.makeRotationAxis(transform.obj, transform.angle));
                    break;
                }
              }
            }
            object.matrix.copy(matrix);
            object.matrix.decompose(object.position, object.quaternion, object.scale);
            jointMap[jointIndex].position = value;
          }
        } else {
          console.warn("THREE.ColladaLoader: Joint " + jointIndex + " does not exist.");
        }
      }
    };
  }
  buildTransformList(node) {
    const transforms = [];
    const xml = this.collada.querySelector('[id="' + node.id + '"]');
    for (let i = 0; i < xml.childNodes.length; i++) {
      const child = xml.childNodes[i];
      if (child.nodeType !== 1) continue;
      let array, vector;
      switch (child.nodeName) {
        case "matrix":
          array = parseFloats(child.textContent);
          const matrix = new Matrix4().fromArray(array).transpose();
          transforms.push({
            sid: child.getAttribute("sid"),
            type: child.nodeName,
            obj: matrix
          });
          break;
        case "translate":
        case "scale":
          array = parseFloats(child.textContent);
          vector = new Vector3().fromArray(array);
          transforms.push({
            sid: child.getAttribute("sid"),
            type: child.nodeName,
            obj: vector
          });
          break;
        case "rotate":
          array = parseFloats(child.textContent);
          vector = new Vector3().fromArray(array);
          const angle = MathUtils.degToRad(array[3]);
          transforms.push({
            sid: child.getAttribute("sid"),
            type: child.nodeName,
            obj: vector,
            angle
          });
          break;
      }
    }
    return transforms;
  }
  buildSkeleton(skeletons, joints) {
    const boneData = [];
    const sortedBoneData = [];
    let i, j, data;
    for (i = 0; i < skeletons.length; i++) {
      const skeleton = skeletons[i];
      let root;
      if (this.hasNode(skeleton)) {
        root = this.getNode(skeleton);
        this.buildBoneHierarchy(root, joints, boneData);
      } else if (this.hasVisualScene(skeleton)) {
        const visualScene = this.library.visualScenes[skeleton];
        const children = visualScene.children;
        for (let j2 = 0; j2 < children.length; j2++) {
          const child = children[j2];
          if (child.type === "JOINT") {
            const root2 = this.getNode(child.id);
            this.buildBoneHierarchy(root2, joints, boneData);
          }
        }
      } else {
        console.error("THREE.ColladaLoader: Unable to find root bone of skeleton with ID:", skeleton);
      }
    }
    for (i = 0; i < joints.length; i++) {
      for (j = 0; j < boneData.length; j++) {
        data = boneData[j];
        if (data.bone.name === joints[i].name) {
          sortedBoneData[i] = data;
          data.processed = true;
          break;
        }
      }
    }
    for (i = 0; i < boneData.length; i++) {
      data = boneData[i];
      if (data.processed === false) {
        sortedBoneData.push(data);
        data.processed = true;
      }
    }
    const bones = [];
    const boneInverses = [];
    for (i = 0; i < sortedBoneData.length; i++) {
      data = sortedBoneData[i];
      bones.push(data.bone);
      boneInverses.push(data.boneInverse);
    }
    return new Skeleton(bones, boneInverses);
  }
  buildBoneHierarchy(root, joints, boneData) {
    root.traverse(function(object) {
      if (object.isBone === true) {
        let boneInverse;
        for (let i = 0; i < joints.length; i++) {
          const joint = joints[i];
          if (joint.name === object.name) {
            boneInverse = joint.boneInverse;
            break;
          }
        }
        if (boneInverse === void 0) {
          boneInverse = new Matrix4();
        }
        boneData.push({ bone: object, boneInverse, processed: false });
      }
    });
  }
  buildNode(data) {
    const objects = [];
    const matrix = data.matrix;
    const nodes = data.nodes;
    const type = data.type;
    const instanceCameras = data.instanceCameras;
    const instanceControllers = data.instanceControllers;
    const instanceLights = data.instanceLights;
    const instanceGeometries = data.instanceGeometries;
    const instanceNodes = data.instanceNodes;
    for (let i = 0, l = nodes.length; i < l; i++) {
      objects.push(this.getNode(nodes[i]));
    }
    for (let i = 0, l = instanceCameras.length; i < l; i++) {
      const instanceCamera = this.getCamera(instanceCameras[i]);
      if (instanceCamera !== null) {
        objects.push(instanceCamera.clone());
      }
    }
    for (let i = 0, l = instanceControllers.length; i < l; i++) {
      const instance = instanceControllers[i];
      const controller = this.getController(instance.id);
      const geometries = this.getGeometry(controller.id);
      const newObjects = this.buildObjects(geometries, instance.materials);
      const skeletons = instance.skeletons;
      const joints = controller.skin.joints;
      const skeleton = this.buildSkeleton(skeletons, joints);
      for (let j = 0, jl = newObjects.length; j < jl; j++) {
        const object2 = newObjects[j];
        if (object2.isSkinnedMesh) {
          object2.bind(skeleton, controller.skin.bindMatrix);
          object2.normalizeSkinWeights();
        }
        objects.push(object2);
      }
    }
    for (let i = 0, l = instanceLights.length; i < l; i++) {
      const instanceLight = this.getLight(instanceLights[i]);
      if (instanceLight !== null) {
        objects.push(instanceLight.clone());
      }
    }
    for (let i = 0, l = instanceGeometries.length; i < l; i++) {
      const instance = instanceGeometries[i];
      const geometries = this.getGeometry(instance.id);
      const newObjects = this.buildObjects(geometries, instance.materials);
      for (let j = 0, jl = newObjects.length; j < jl; j++) {
        objects.push(newObjects[j]);
      }
    }
    for (let i = 0, l = instanceNodes.length; i < l; i++) {
      objects.push(this.getNode(instanceNodes[i]).clone());
    }
    let object;
    if (nodes.length === 0 && objects.length === 1) {
      object = objects[0];
    } else {
      object = type === "JOINT" ? new Bone() : new Group();
      for (let i = 0; i < objects.length; i++) {
        object.add(objects[i]);
      }
    }
    object.name = type === "JOINT" ? data.sid : data.name;
    if (type !== "JOINT" && this.hasPivotTransforms(data)) {
      return this.wrapWithTransformHierarchy(object, data);
    }
    object.matrix.copy(matrix);
    object.matrix.decompose(object.position, object.quaternion, object.scale);
    return object;
  }
  wrapWithTransformHierarchy(contentObject, nodeData) {
    const nodeId = nodeData.id;
    this.transformNodes[nodeId] = {};
    const transformOrder = nodeData.transformOrder;
    const transformData = nodeData.transformData;
    const rootNode = new Group();
    rootNode.name = nodeData.name;
    let currentParent = rootNode;
    for (let i = 0; i < transformOrder.length; i++) {
      const sid = transformOrder[i];
      const info = transformData[sid];
      const transformNode = new Group();
      transformNode.name = nodeData.name + "_" + sid;
      switch (info.type) {
        case "translate":
          transformNode.position.set(info.x, info.y, info.z);
          break;
        case "rotate": {
          const axis = new Vector3(info.axis[0], info.axis[1], info.axis[2]);
          const angle = MathUtils.degToRad(info.angle);
          transformNode.quaternion.setFromAxisAngle(axis, angle);
          transformNode.userData.rotationAxis = axis;
          break;
        }
        case "scale":
          transformNode.scale.set(info.x, info.y, info.z);
          break;
        case "matrix": {
          const matrix = new Matrix4().fromArray(info.array).transpose();
          matrix.decompose(transformNode.position, transformNode.quaternion, transformNode.scale);
          break;
        }
      }
      this.transformNodes[nodeId][sid] = transformNode;
      currentParent.add(transformNode);
      currentParent = transformNode;
    }
    currentParent.add(contentObject);
    return rootNode;
  }
  resolveMaterialBinding(keys, instanceMaterials) {
    const materials = [];
    for (let i = 0, l = keys.length; i < l; i++) {
      const id = instanceMaterials[keys[i]];
      if (id === void 0) {
        console.warn("THREE.ColladaLoader: Material with key %s not found. Apply fallback material.", keys[i]);
        materials.push(this.fallbackMaterial);
      } else {
        materials.push(this.getMaterial(id));
      }
    }
    return materials;
  }
  get fallbackMaterial() {
    if (this._fallbackMaterial === void 0) {
      this._fallbackMaterial = new MeshBasicMaterial({
        name: Loader.DEFAULT_MATERIAL_NAME,
        color: 16711935
      });
    }
    return this._fallbackMaterial;
  }
  buildObjects(geometries, instanceMaterials) {
    const objects = [];
    for (const type in geometries) {
      const geometry = geometries[type];
      const materials = this.resolveMaterialBinding(geometry.materialKeys, instanceMaterials);
      if (materials.length === 0) {
        if (type === "lines" || type === "linestrips") {
          materials.push(new LineBasicMaterial());
        } else {
          materials.push(new MeshPhongMaterial());
        }
      }
      if (type === "lines" || type === "linestrips") {
        for (let i = 0, l = materials.length; i < l; i++) {
          const material2 = materials[i];
          if (material2.isMeshPhongMaterial === true || material2.isMeshLambertMaterial === true) {
            const lineMaterial = new LineBasicMaterial();
            lineMaterial.color.copy(material2.color);
            lineMaterial.opacity = material2.opacity;
            lineMaterial.transparent = material2.transparent;
            materials[i] = lineMaterial;
          }
        }
      }
      const skinning = geometry.data.attributes.skinIndex !== void 0;
      const material = materials.length === 1 ? materials[0] : materials;
      let object;
      switch (type) {
        case "lines":
          object = new LineSegments(geometry.data, material);
          break;
        case "linestrips":
          object = new Line(geometry.data, material);
          break;
        case "triangles":
        case "polygons":
        case "polylist":
          if (skinning) {
            object = new SkinnedMesh(geometry.data, material);
          } else {
            object = new Mesh(geometry.data, material);
          }
          break;
      }
      objects.push(object);
    }
    return objects;
  }
  hasNode(id) {
    return this.library.nodes[id] !== void 0;
  }
  getNode(id) {
    return this.getBuild(this.library.nodes[id], this.buildNode.bind(this));
  }
  buildVisualScene(data) {
    const group = new Group();
    group.name = data.name;
    const children = data.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      group.add(this.getNode(child.id));
    }
    return group;
  }
  hasVisualScene(id) {
    return this.library.visualScenes[id] !== void 0;
  }
  getVisualScene(id) {
    return this.getBuild(this.library.visualScenes[id], this.buildVisualScene.bind(this));
  }
  parseScene(xml) {
    const instance = getElementsByTagName(xml, "instance_visual_scene")[0];
    return this.getVisualScene(this.parseId(instance.getAttribute("url")));
  }
  parseId(text) {
    return text.substring(1);
  }
  setupAnimations() {
    const clips = this.library.clips;
    if (this.isEmpty(clips) === true) {
      if (this.isEmpty(this.library.animations) === false) {
        const tracks = [];
        for (const id in this.library.animations) {
          const animationTracks = this.getAnimation(id);
          for (let i = 0, l = animationTracks.length; i < l; i++) {
            tracks.push(animationTracks[i]);
          }
        }
        this.buildDeferredPivotAnimationTracks(tracks);
        this.animations.push(new AnimationClip("default", -1, tracks));
      }
    } else {
      for (const id in clips) {
        this.animations.push(this.getAnimationClip(id));
      }
    }
  }
  buildDeferredPivotAnimationTracks(tracks) {
    for (const nodeId in this.deferredPivotAnimations) {
      const nodeData = this.library.nodes[nodeId];
      if (!nodeData) continue;
      const mergedChannels = this.deferredPivotAnimations[nodeId];
      this.buildTransformHierarchyTracks(nodeId, mergedChannels, nodeData, tracks);
    }
  }
  buildTransformHierarchyTracks(nodeId, nodeChannels, nodeData, tracks) {
    const transformNodes = this.transformNodes[nodeId];
    if (!transformNodes) {
      console.warn("THREE.ColladaLoader: Transform hierarchy not found for node:", nodeId);
      return;
    }
    for (const sid in nodeChannels) {
      const transformNode = transformNodes[sid];
      if (!transformNode) continue;
      const transformType = nodeData.transforms[sid];
      const transformInfo = nodeData.transformData[sid];
      const channelData = nodeChannels[sid];
      switch (transformType) {
        case "translate":
          this.buildHierarchyTranslateTrack(transformNode, channelData, transformInfo, tracks);
          break;
        case "rotate":
          this.buildHierarchyRotateTrack(transformNode, channelData, transformInfo, tracks);
          break;
        case "scale":
          this.buildHierarchyScaleTrack(transformNode, channelData, transformInfo, tracks);
          break;
      }
    }
  }
  buildHierarchyTranslateTrack(transformNode, channelData, transformInfo, tracks) {
    if (channelData.default && channelData.default.stride === 3) {
      const data = channelData.default;
      const track2 = new VectorKeyframeTrack(
        transformNode.uuid + ".position",
        Array.from(data.times),
        Array.from(data.values)
      );
      const interpolationInfo2 = this.getInterpolationInfo(channelData);
      this.applyInterpolation(track2, interpolationInfo2, channelData);
      tracks.push(track2);
      return;
    }
    const times = this.getTimesForAllAxes(channelData);
    if (times.length === 0) return;
    const values = [];
    const interpolationInfo = this.getInterpolationInfo(channelData);
    for (let i = 0; i < times.length; i++) {
      const time = times[i];
      const x = this.getValueAtTime(channelData.X, time, transformInfo.x);
      const y = this.getValueAtTime(channelData.Y, time, transformInfo.y);
      const z = this.getValueAtTime(channelData.Z, time, transformInfo.z);
      values.push(x, y, z);
    }
    const track = new VectorKeyframeTrack(
      transformNode.uuid + ".position",
      times,
      values
    );
    this.applyInterpolation(track, interpolationInfo);
    tracks.push(track);
  }
  buildHierarchyRotateTrack(transformNode, channelData, transformInfo, tracks) {
    const angleData = channelData.ANGLE || channelData.default;
    if (!angleData) return;
    const times = Array.from(angleData.times);
    if (times.length === 0) return;
    const axis = transformNode.userData.rotationAxis || new Vector3(transformInfo.axis[0], transformInfo.axis[1], transformInfo.axis[2]);
    const quaternion = new Quaternion();
    const prevQuaternion = new Quaternion();
    const values = [];
    const interpolationInfo = this.getInterpolationInfo(channelData);
    for (let i = 0; i < times.length; i++) {
      const time = times[i];
      const angleDegrees = this.getValueAtTime(angleData, time, transformInfo.angle);
      const angleRadians = MathUtils.degToRad(angleDegrees);
      quaternion.setFromAxisAngle(axis, angleRadians);
      if (i > 0 && prevQuaternion.dot(quaternion) < 0) {
        quaternion.x = -quaternion.x;
        quaternion.y = -quaternion.y;
        quaternion.z = -quaternion.z;
        quaternion.w = -quaternion.w;
      }
      prevQuaternion.copy(quaternion);
      values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    }
    const track = new QuaternionKeyframeTrack(
      transformNode.uuid + ".quaternion",
      times,
      values
    );
    this.applyInterpolation(track, interpolationInfo);
    tracks.push(track);
  }
  buildHierarchyScaleTrack(transformNode, channelData, transformInfo, tracks) {
    if (channelData.default && channelData.default.stride === 3) {
      const data = channelData.default;
      const track2 = new VectorKeyframeTrack(
        transformNode.uuid + ".scale",
        Array.from(data.times),
        Array.from(data.values)
      );
      const interpolationInfo2 = this.getInterpolationInfo(channelData);
      this.applyInterpolation(track2, interpolationInfo2, channelData);
      tracks.push(track2);
      return;
    }
    const times = this.getTimesForAllAxes(channelData);
    if (times.length === 0) return;
    const values = [];
    const interpolationInfo = this.getInterpolationInfo(channelData);
    for (let i = 0; i < times.length; i++) {
      const time = times[i];
      const x = this.getValueAtTime(channelData.X, time, transformInfo.x);
      const y = this.getValueAtTime(channelData.Y, time, transformInfo.y);
      const z = this.getValueAtTime(channelData.Z, time, transformInfo.z);
      values.push(x, y, z);
    }
    const track = new VectorKeyframeTrack(
      transformNode.uuid + ".scale",
      times,
      values
    );
    this.applyInterpolation(track, interpolationInfo);
    tracks.push(track);
  }
}
class ColladaLoader extends Loader {
  /**
   * Starts loading from the given URL and passes the loaded Collada asset
   * to the `onLoad()` callback.
   *
   * @param {string} url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param {function({scene:Group,animations:Array<AnimationClip>,kinematics:Object})} onLoad - Executed when the loading process has been finished.
   * @param {onProgressCallback} onProgress - Executed while the loading is in progress.
   * @param {onErrorCallback} onError - Executed when errors occur.
   */
  load(url, onLoad, onProgress, onError) {
    const scope = this;
    const path = scope.path === "" ? LoaderUtils.extractUrlBase(url) : scope.path;
    const loader = new FileLoader(scope.manager);
    loader.setPath(scope.path);
    loader.setRequestHeader(scope.requestHeader);
    loader.setWithCredentials(scope.withCredentials);
    loader.load(url, function(text) {
      try {
        onLoad(scope.parse(text, path));
      } catch (e) {
        if (onError) {
          onError(e);
        } else {
          console.error(e);
        }
        scope.manager.itemError(url);
      }
    }, onProgress, onError);
  }
  /**
   * Parses the given Collada data and returns a result object holding the parsed scene,
   * an array of animation clips and kinematics.
   *
   * @param {string} text - The raw Collada data as a string.
   * @param {string} [path] - The asset path.
   * @return {?{scene:Group,animations:Array<AnimationClip>,kinematics:Object}} An object representing the parsed asset.
   */
  parse(text, path) {
    if (text.length === 0) {
      return { scene: new Scene() };
    }
    const parser = new ColladaParser();
    const parseResult = parser.parse(text);
    if (parseResult === null) {
      return null;
    }
    const { library, asset, collada } = parseResult;
    const textureLoader = new TextureLoader(this.manager);
    textureLoader.setPath(this.resourcePath || path).setCrossOrigin(this.crossOrigin);
    let tgaLoader;
    if (TGALoader) {
      tgaLoader = new TGALoader(this.manager);
      tgaLoader.setPath(this.resourcePath || path);
    }
    const composer = new ColladaComposer(library, collada, textureLoader, tgaLoader);
    const { scene, animations, kinematics } = composer.compose();
    scene.animations = animations;
    if (asset.upAxis === "Z_UP") {
      console.warn("THREE.ColladaLoader: You are loading an asset with a Z-UP coordinate system. The loader just rotates the asset to transform it into Y-UP. The vertex data are not converted, see #24289.");
      scene.rotation.set(-Math.PI / 2, 0, 0);
    }
    scene.scale.multiplyScalar(asset.unit);
    return {
      get animations() {
        console.warn("THREE.ColladaLoader: Please access animations over scene.animations now.");
        return animations;
      },
      kinematics,
      library,
      scene
    };
  }
}
export {
  ColladaLoader
};
//# sourceMappingURL=ColladaLoader-DKPqz48M.mjs.map
