class FileHandler {
  events = {};

  constructor(elm) {
    window.addEventListener('drop', this.handleDrop.bind(this), false);
    window.addEventListener('dragover', this.handleDragOver.bind(this), false);
    window.addEventListener('paste', this.handlePaste.bind(this), false);
  }

  handleDragOver(e) {
    e.preventDefault();
  }

  // https://stackoverflow.com/a/44918780/4772064
  getFiles(dataTransferItems) {
    function traverseFileTreePromise(item, path='') {
      return new Promise( resolve => {
        if (item.isFile) {
          item.file(file => {
            file.path = path; //save full path
            files.push(file)
            resolve(file)
          })
        } else if (item.isDirectory) {
          let dirReader = item.createReader()
          dirReader.readEntries(entries => {
            let entriesPromises = []
            for (let entr of entries)
              entriesPromises.push(traverseFileTreePromise(entr, path + item.name + "/"))
            resolve(Promise.all(entriesPromises))
          })
        }
      })
    }
  
    let files = []
    return new Promise((resolve, reject) => {
      let entriesPromises = []
      for (let it of dataTransferItems)
        entriesPromises.push(traverseFileTreePromise(it.webkitGetAsEntry()))
      Promise.all(entriesPromises)
        .then(entries => {
          resolve(files)
        })
    })
  }

  handleDrop(e) {
    e.preventDefault();
    
    this.getFiles(e.dataTransfer.items).then(files => {
      this.emit('files', {
        target : e.dataTransfer.folder,
        files : files
      });
    })
  }

  handlePaste(e) {
    console.log('paste');
    e.preventDefault();
    this.emit('files', {
      target : null,
      files : Array.from(e.clipboardData.files)
    });
  }

  manualSelect(e) {
    e.preventDefault();

    var input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('multiple', 'multiple');
    
    input.onchange = e => { 
      console.log(e);
      var files = [];
  
      for (var i = 0; i < e.target.files.length; i++) {
        files.push(e.target.files[i]);
      }
      // getting a hold of the file reference
      this.emit('files', {
        files : files
      });
    }
    
    input.click();
  }

  on(name, listener) {
    if (!this.events[name]) this.events[name] = [];
    this.events[name].push(listener);
  }

  emit(name, data) {
    this.events[name].forEach(callback => callback(data));
  }
}