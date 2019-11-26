const { app, BrowserWindow, Menu } = require('electron')
const { ipcMain } = require('electron')
var fs = require("fs")

// 保持对window对象的全局引用，如果不这么做的话，当JavaScript对象被
// 垃圾回收的时候，window对象将会自动的关闭
let win

function createWindow() {
  // 创建浏览器窗口。
  win = new BrowserWindow({
    width: 1111,
    height: 800,
    webPreferences: {
      nodeIntegration: true
    },
  })
  // 删除菜单栏
  Menu.setApplicationMenu(null);
  // 加载index.html文件
  win.loadFile('index.html')

  // 打开开发者工具
  win.webContents.openDevTools()

  // 当 window 被关闭，这个事件会被触发。
  win.on('closed', () => {
    // 取消引用 window 对象，如果你的应用支持多窗口的话，
    // 通常会把多个 window 对象存放在一个数组里面，
    // 与此同时，你应该删除相应的元素。
    win = null
  })
}

// Electron 会在初始化后并准备
// 创建浏览器窗口时，调用这个函数。
// 部分 API 在 ready 事件触发后才能使用。
app.on('ready', createWindow)

// 当全部窗口关闭时退出。
app.on('window-all-closed', () => {
  damatoSave();
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // 在macOS上，当单击dock图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  if (win === null) {
    createWindow()
  }
})

// 在这个文件中，你可以续写应用剩下主进程代码。
// 也可以拆分成几个文件，然后用 require 导入。
ipcMain.on('sync-text', (event, arg) => {
  console.log(arg) // prints "ping"
  event.returnValue = 'main.js sync-test return'
})

// 全局常量
const DAMATO_STORAGE_PATH = 'damato.json'
ARCHIVED_DAMATOS_STORAGE_PATH = 'archived_damatos.json'
ANALYSED_DATA_STORAGE_PATH = 'analysed_data.json'
// 全局变量
// 加载damato数据
fs.exists(DAMATO_STORAGE_PATH, function (exists) {
  if (exists) {
    fs.readFile(DAMATO_STORAGE_PATH, function (err, data) {
      if (err) {
        // global.damato = initDamatoCreate();
        console.error(err);
        return false;
      }
      let damatoJsonString = data.toString();
      let damatoJsonObj = JSON.parse(damatoJsonString);
      let currentDate = new Date().toLocaleDateString();
      let damatoDate = new Date(damatoJsonObj.createTime).toLocaleDateString();
      if (currentDate != damatoDate) {
        damatoArchive(damatoJsonObj);
        global.damato = damatoClean(damatoJsonObj);
      } else {
        global.damato = damatoJsonObj;
      }
      return true;
    })
  } else {
    global.damato = damatoInit();
  }
})

// 初始damato创建
function damatoInit() {
  let currentTime = new Date().getTime();
  return { tasks: [], createTime: currentTime, id: '' };
}

// 清除damato subtask 完成记录和创建时间
function damatoClean(archivedDamato) {
  for (var taskId in archivedDamato.tasks) {
    let currentTask = archivedDamato.tasks[taskId]
    for (var subTaskId in currentTask.subTasks) {
      let currentSubTask = currentTask.subTasks[subTaskId];
      currentSubTask.status = '';
      currentSubTask.startTime = '';
    }
  }
  archivedDamato.createTime = new Date().getTime();
  return archivedDamato;
}

// damato 归档
function damatoArchive(damato) {
  fs.exists(ARCHIVED_DAMATOS_STORAGE_PATH, function (exists) {
    if (exists) {
      let archivedDamatosString = fs.readFileSync(ARCHIVED_DAMATOS_STORAGE_PATH).toString();
      var archivedDamatosObj = JSON.parse(archivedDamatosString);
      damato.id = archivedDamatosObj.length;
      archivedDamatosObj.push(damato);
    } else {
      var archivedDamatosObj = [];
      damato.id = archivedDamatosObj.length;
      archivedDamatosObj.push(damato);
    }
    fs.writeFile(ARCHIVED_DAMATOS_STORAGE_PATH, JSON.stringify(archivedDamatosObj), function (err, data) {
      if (err) {
        console.error(err);
        return false;
      }
      return true;
    });
  })
}

// 保存damato
function damatoSave() {
  fs.writeFile(DAMATO_STORAGE_PATH, JSON.stringify(global.damato), function (err, data) {
    if (err) {
      console.error(err);
      return false;
    }
    return true;
  });
}
ipcMain.on('damatoSave', (event, arg) => {
  console.log(arg); // prints "ping"
  damatoSave();
  event.returnValue = 'damato saved'
})