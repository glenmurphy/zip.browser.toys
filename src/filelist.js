function createElm(opts) {
  var e = document.createElement(opts.type ? opts.type : 'div');
  if (opts.class) e.className = opts.class;
  if (opts.parent) opts.parent.appendChild(e);
  if (opts.innerHTML) e.innerHTML = opts.innerHTML;
  return e;
}

var Selection = {
  items : [],
  dragging : false,
  add : function(item) {
    // Check for dupes
    if (Selection.items.indexOf(item) != -1)
      return;
    
    // Remove any parents or children of this selection
    var removeQueue = [];
    Selection.items.forEach(existing => {
      if (existing instanceof Folder && existing.isParentOf(item))
        removeQueue.push(existing);
      else if (item instanceof Folder && existing.isChildOf(item))
        removeQueue.push(existing);
    });
    removeQueue.forEach(remove => {
      Selection.remove(remove);
    })

    Selection.items.push(item);
    item.handleSelected();
  },
  remove : function(item) {
    var index = Selection.items.indexOf(item);
    if (index > -1) {
      Selection.items.splice(index, 1);
    }
    item.handleDeselected();
  },
  clear : function() {
    Selection.items.forEach(item => {
      item.handleDeselected();
    })
    Selection.items = [];
  }
}

var contextMenuInstance;
function getContextMenu() {
  if (!contextMenuInstance)
    contextMenuInstance = new ContextMenu();
  return contextMenuInstance;
}

class ContextMenu {
  constructor() {
    if (ContextMenu.instance)
      return ContextMenu.instance;
    
    document.body.addEventListener('click', this.handleDocumentClick.bind(this));
    this.elm = createElm({ parent : document.body, class : 'context-menu' });
    this.elm.style.display = 'none';

    this.downloadButton = createElm({ parent : this.elm, innerHTML : 'download' });
    this.downloadButton.addEventListener('click', this.handleDownload.bind(this));
    this.renameButton = createElm({ parent : this.elm, innerHTML : 'rename' });
    this.renameButton.addEventListener('click', this.handleRename.bind(this));
    this.deleteButton = createElm({ parent : this.elm, innerHTML : 'delete' });
    this.deleteButton.addEventListener('click', this.handleDelete.bind(this));

    this.item = null;
    ContextMenu.instance = this;
  }

  dismiss() {
    this.item = null;
    this.elm.style.display = 'none';
  }

  handleDocumentClick(e) {
    this.dismiss();
  }

  handleDownload(e) {
    this.item.download();
    this.dismiss();
  }

  handleRename(e) {
    this.item.rename();
    this.dismiss();
  }

  handleDelete(e) {
    this.item.delete();
    this.dismiss();
  }

  invoke(item, e) {
    this.item = item;
    if (item instanceof Folder) {
      this.downloadButton.style.display = 'none';
      this.renameButton.style.display = 'none';
      this.deleteButton.style.display = 'block';
    } else if (item instanceof Doc) {
      this.downloadButton.style.display = 'block';
      this.renameButton.style.display = 'none';
      this.deleteButton.style.display = 'block';
    }
    var t = item.elm.getBoundingClientRect();
    this.elm.style.top = t.top + 10;
    this.elm.style.left = e.clientX + 10;
    this.elm.style.display = 'block';
  }
}

// 'File' was taken
class Doc {
  constructor(file, parentFolder) {
    this.file = file;
    this.parentFolder = parentFolder;

    this.elm = createElm({ innerHTML : file.name, class : 'file', parent : parentFolder.docList });
    this.elm.setAttribute('draggable', true);
    this.elm.addEventListener('click', this.handleMouseUp.bind(this), true);
    this.elm.addEventListener('contextmenu', this.handleContextMenu.bind(this), true);
    this.elm.addEventListener('dragstart', this.handleDragStart.bind(this));

    this.selected = false;
  }

  isChildOf(folder) {
    if (folder == this.parentFolder)
      return true;
    return this.parentFolder.isChildOf(folder);
  }

  handleContextMenu(e) {
    Selection.clear();
    Selection.add(this);
    getContextMenu().invoke(this, e);
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  handleMouseUp(e) {
    if (this.selected == false) {
      Selection.add(this);
    } else {
      Selection.remove(this);
    }
  }

  handleDragStart(e) {
    Selection.add(this);
    Selection.dragging = true;
  }

  handleSelected() {
    this.elm.classList.add('selected');
    this.selected = true;
  }

  handleDeselected() {
    this.elm.classList.remove('selected');
    this.selected = false;
  }

  delete() {
    this.parentFolder.removeDoc(this);
    Selection.remove(this);
  }

  download() {
    saveAs(this.file, this.file.name);
  }

  move(folder) {
    this.parentFolder.removeDoc(this);
    this.parentFolder = folder;
    folder.addDoc(this);
  }

  async arrayBuffer() {
    return this.file.arrayBuffer()
  }
}

class Folder {
  name = "";
  folders = {};
  docs = {};

  constructor(name, parent) {
    this.parent = parent;
    this.elm = createElm({ class : 'folder' });
    this.elm.addEventListener('dragenter', this.handleDragEnter.bind(this));
    this.elm.addEventListener('dragleave', this.handleDragLeave.bind(this));
    this.name = name;

    this.folderName = createElm({ class : 'folderName', parent : this.elm, innerHTML : '/'+name });
    if (this.parent) {
      this.folderName.setAttribute('draggable', true);
      this.folderName.addEventListener('contextmenu', this.handleContextMenu.bind(this), true);
      this.folderName.addEventListener('mouseup', this.handleMouseUp.bind(this));
      this.folderName.addEventListener('dragstart', this.handleDragStart.bind(this));
    }
    this.folderList = createElm({ class: 'folderList', parent : this.elm });
    this.docList = createElm({ class : 'fileList', parent : this.elm});
    
    this.folderName.addEventListener('drop', this.handleDrop.bind(this), false);
    this.docList.addEventListener('drop', this.handleDrop.bind(this), false);
    this.selected = false;

    this.dragTarget;
  }

  handleContextMenu(e) {
    Selection.clear();
    Selection.add(this);
    getContextMenu().invoke(this, e);
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dragTarget = e.target;
    this.elm.classList.add('dragover');
  }

  handleDragLeave(e) {
    if (e.target != this.dragTarget) return;
    e.preventDefault();
    e.stopPropagation();
    this.elm.classList.remove('dragover');
  }

  handleDrop(e) {
    e.preventDefault();
    this.elm.classList.remove('dragover');

    if (!Selection.dragging) {
      console.log('files');
      e.dataTransfer.folder = this;
      return;
    }

    // Check to see if the selection contains a parent of this target
    Selection.items.forEach(item => {
      if (item instanceof Folder && this.isChildOf(item)) {
        Selection.clear();
        Selection.dragging = false;
        return;
      }
    });

    e.stopPropagation();

    // Movement may modify selection, so copy the selection array
    var items = [];
    Selection.items.forEach(item => { items.push(item); });
    items.forEach(item => {
      item.move(this);
    })
    Selection.clear();
    Selection.dragging = false;
  }

  isChildOf(folder) {
    var c = this;
    while(c) {
      if (c == folder)
        return true;
      c = c.parent;
    }
    return false;
  }

  isParentOf(item) {
    return (item.isChildOf(this));
  }

  handleMouseUp(e) {
    if (!this.parent) return;

    if (this.selected == false) {
      Selection.add(this);
    } else {
      Selection.remove(this);
    }
  }

  handleDragStart(e) {
    if (!this.parent) return;
    
    Selection.add(this);
    Selection.dragging = true;
  }

  handleSelected() {
    this.elm.classList.add('selected');
    this.folderName.classList.add('selected');
    // TODO: deselect all child selections
    this.selected = true;
  }

  handleDeselected() {
    this.elm.classList.remove('selected');
    this.folderName.classList.remove('selected');
    this.selected = false;
  }

  move(folder) {
    this.parent.removeFolder(this);
    this.parent = folder;
    folder.folders[this.name] = this;
    folder.folderList.appendChild(this.elm);
  }

  delete() {
    this.parent.removeFolder(this);
  }

  setName(name) {
    this.folderName.innerHTML = '/' + name;
    this.name = name;
    // don't forget to update parent folder{} name
  }

  createFolder(folderName) {
    // TODO: check for existing folder of same name and merge
    this.folders[folderName] = new Folder(folderName, this);
    this.folderList.appendChild(this.folders[folderName].elm);
  }

  removeFolder(folder) {
    delete this.folders[folder.name];
    this.folderList.removeChild(folder.elm);
    Selection.remove(folder);
  }

  removeDoc(doc) {
    delete this.docs[doc.file.name];
    this.docList.removeChild(doc.elm);
    Selection.remove(doc);
  }

  addDoc(doc) {
    if (doc.file.name in this.docs) {
      this.removeDoc(this.docs[doc.file.name]);
    }

    doc.parentFolder = this;
    this.docs[doc.file.name] = doc;

    var names = [];
    for (var name in this.docs) {
      names.push(name);
    }
    names.sort();

    names.forEach(name => {
      this.docList.appendChild(this.docs[name].elm);
    })
  }

  addFile(file, pathArray) {
    if (!pathArray || (pathArray.length == 1 && pathArray[0] == "")) {
      this.addDoc(new Doc(file, this));

      console.log('added file:' + file.name);
      return;
    }

    var nextFolder = pathArray.shift();
    if (!nextFolder) throw new Error("Empty Folder");
    
    if (!(nextFolder in this.folders)) {
      this.createFolder(nextFolder);
    }
    this.folders[nextFolder].addFile(file, pathArray);
  }
}

class FileList {
  constructor(parentElm) {
    this.fileHandler = new FileHandler();
    
    document.getElementById('picker').addEventListener('click',
      this.fileHandler.manualSelect.bind(this.fileHandler), false);
    
    this.fileHandler.on('files', this.handleFiles.bind(this));

    this.elm = createElm({ parent : parentElm });

    this.controls = createElm({ class : 'controls', parent : this.elm });

    this.root = new Folder('.');
    this.elm.appendChild(this.root.elm);

    this.hideControls();

    this.zipStatus = createElm({ class : 'control status', parent : this.controls, innerHTML : 'creating ...' });
    this.zipStatus.style.display = 'none';

    this.zipButton = createElm({ class : 'control zip', parent : this.controls, innerHTML : 'download zip' });
    this.zipButton.addEventListener('click', this.zip.bind(this));

    this.clearButton = createElm(
      { class : 'control', parent : this.controls, innerHTML : 'clear' });
    this.clearButton.addEventListener('click', this.clear.bind(this));
  }

  showControls() {
    document.getElementById('title').style.display = 'none';
    this.root.elm.style.display = 'block';
    this.controls.style.display = 'block';
  }

  hideControls() {
    document.getElementById('title').style.display = 'block';
    this.root.elm.style.display = 'none';
    this.controls.style.display = 'none';
  }

  clear() {
    var old = this.root.elm;

    this.root = new Folder('.');
    this.elm.replaceChild(this.root.elm, old);
    this.hideControls();
  }

  async handleZip(file, target) {
    var arrBuf = await file.arrayBuffer();
    var compressed = new Uint8Array(arrBuf);
    var decompressed = fflate.unzipSync(compressed);
    for (var path in decompressed) {
      var p = path.split("/");
      var content = new File([decompressed[path]], p.pop());
      if (content.size == 0) continue;
      console.log(content);
      content.path = p.length ? p.join("/") + "/" : '';
      this.addFile(content, target);
    }
  }

  async handleFiles(res) {
    if (res.files.length == 0) return;
  
    res.files.forEach((file) => {
      if (res.files.length == 1 && file.name.split(".").pop() == 'zip') {
        // We special-case single-zip file additions to mean unpack, whereas
        // zip files in folders etc are inserted as-is. This could be edge-case
        // confusing and main-case OK
        this.handleZip(file, res.target);
      } else {
        this.addFile(file, res.target);
      }
    });

    this.root.setName(this.getName());
  }

  addFile(file, folder) {
    if (!folder) folder = this.root;
    folder.addFile(file, file.path ? file.path.split("/") : null);
    this.showControls();
  }

  getName() {
    if (Object.keys(this.root.docs).length + Object.keys(this.root.folders).length == 1) {
      if (Object.keys(this.root.docs).length == 1)
        return Object.keys(this.root.docs)[0] + '.zip';

      if (Object.keys(this.root.folders).length == 1)
        return Object.keys(this.root.folders)[0] + '.zip';
    }
    return "files_" + parseInt(new Date().getTime() / 1000) + '.zip'
  }

  async zip() {
    async function grabFiles(folder) {
      var res = {};
      for (var child in folder.folders) {
        res[child] = await grabFiles(folder.folders[child]);
      }
      for (var filename in folder.docs) {
        var arrBuf = await folder.docs[filename].arrayBuffer();
        res[filename] = new Uint8Array(arrBuf);
      }
      return res;
    }
    
    this.zipStatus.style.display = 'inline';
    this.zipButton.style.display = 'none';

    var zipTree = await grabFiles(this.root);
    const zipped = fflate.zipSync(zipTree);

    this.zipStatus.style.display = 'none';
    this.zipButton.style.display = 'inline';

    saveAs(new Blob([zipped], {type : "application/zip"}), this.getName());
  }
}