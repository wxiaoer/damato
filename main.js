const {
  app,
  BrowserWindow,
  Menu
} = require('electron')
const emailSender = require('./email')

// 保持对window对象的全局引用，如果不这么做的话，当JavaScript对象被
// 垃圾回收的时候，window对象将会自动的关闭
let win
// let tray = null

function createWindow() {
  // 创建浏览器窗口。
  win = new BrowserWindow({
    width: 1111,
    height: 800,
    webPreferences: {
      nodeIntegration: true
    },
    show: false,
  })
  win.once('ready-to-show', () => {
    win.show()
  })
  // 删除菜单栏
  Menu.setApplicationMenu(null)
  // 加载index.html文件
  win.loadFile('index.html')
  // 打开开发者工具
  // win.webContents.openDevTools()

  // 当 window 被关闭，这个事件会被触发。
  win.on('closed', () => {
    // 取消引用 window 对象，如果你的应用支持多窗口的话，
    // 通常会把多个 window 对象存放在一个数组里面，
    // 与此同时，你应该删除相应的元素。
    win = null
  })

  // 关闭时最小化到托盘
  // win.on('close', (event) => {
  //   win.hide();
  //   win.setSkipTaskbar(true);
  //   event.preventDefault();
  // });
  // mac os
  // win.on('show', () => {
  //   tray.setHighlightMode('always')
  // })
  // win.on('hide', () => {
  //   tray.setHighlightMode('never')
  // })
  //创建系统通知区菜单
  // const path = require('path');
  // const {Tray} = require('electron');
  // tray = new Tray(path.join(__dirname, 'icon.ico'));
  // const contextMenu = Menu.buildFromTemplate([
  //   { label: '退出', click: () => { win.destroy() } },//我们需要在这里有一个真正的退出（这里直接强制退出）
  // ])
  // tray.setToolTip('Damato')
  // tray.setContextMenu(contextMenu)
  // tray.on('click', () => { //我们这里模拟桌面程序点击通知区图标实现打开关闭应用的功能
  //   win.isVisible() ? win.hide() : win.show()
  //   win.isVisible() ? win.setSkipTaskbar(false) : win.setSkipTaskbar(true);
  // })

}

// Electron 会在初始化后并准备
// 创建浏览器窗口时，调用这个函数。
// 部分 API 在 ready 事件触发后才能使用。
app.on('ready', createWindow)

// 当全部窗口关闭时退出。
app.on('window-all-closed', () => {
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

/* 业务代码 */

// 全局常量
const DAMATO_STORAGE_PATH = 'damato.json'
const ARCHIVED_DAMATOS_STORAGE_PATH = 'archived_damatos.json'

// 全局变量
// 加载damato数据
var fs = require("fs")
const {
  ipcMain
} = require('electron')

// 加载damato
ipcMain.on('damatoLoad', (event, arg) => {
  fs.exists(DAMATO_STORAGE_PATH, function (exists) {
    if (exists) {
      fs.readFile(DAMATO_STORAGE_PATH, function (err, data) {
        if (err) {
          console.error(err)
          event.returnValue = false
        }
        let damatoJsonString = data.toString()
        let damatoJsonObj = JSON.parse(damatoJsonString)
        let currentDate = new Date().toLocaleDateString()
        let damatoDate = new Date(damatoJsonObj.createTime).toLocaleDateString()
        if (currentDate != damatoDate) {
          damatoArchive(damatoJsonObj)
          event.returnValue = damatoClean(damatoJsonObj)
        } else {
          event.returnValue = damatoJsonObj
        }
      })
    } else {
      event.returnValue = emptyDamatoCreate()
    }
  })
})

// 加载历史damato
ipcMain.on('archivedDamatosLoad', (event, arg) => {
  fs.exists(ARCHIVED_DAMATOS_STORAGE_PATH, function (exists) {
    if (exists) {
      fs.readFile(ARCHIVED_DAMATOS_STORAGE_PATH, function (err, data) {
        if (err) {
          console.error(err)
          event.returnValue = false
        }
        let archivedDamatosJsonString = data.toString()
        let archivedDamatosJsonObj = JSON.parse(archivedDamatosJsonString)
        event.returnValue = archivedDamatosJsonObj
      })
    } else {
      event.returnValue = []
    }
  })
})

// 空白 damat 创建
function emptyDamatoCreate() {
  return {
    tasks: [],
    createTime: new Date().getTime()
  }
}

// 清除damato subtask 完成记录和创建时间
function damatoClean(archivedDamato) {
  let cleanDamato = JSON.parse(JSON.stringify(archivedDamato));
  for (let task of cleanDamato.tasks) {
    for (let subTask of task.subTasks) {
      subTask.status = ''
      subTask.startTime = ''
    }
  }
  cleanDamato.createTime = new Date().getTime()
  return cleanDamato
}

// damato 归档
function damatoArchive(damato) {
  var damato = JSON.parse(JSON.stringify(damato))
  fs.exists(ARCHIVED_DAMATOS_STORAGE_PATH, function (exists) {
    var archivedDamatosObj
    var createDate = new Date(damato.createTime)
    var createDateFormate = createDate.toLocaleDateString()
    if (exists) {
      let archivedDamatosString = fs.readFileSync(ARCHIVED_DAMATOS_STORAGE_PATH).toString()
      archivedDamatosObj = JSON.parse(archivedDamatosString)
      archivedDamatosObj[createDateFormate] = damato
    } else {
      archivedDamatosObj = {
        // []为了变量转成string
        [createDateFormate]: damato
      }
    }
    fs.writeFile(ARCHIVED_DAMATOS_STORAGE_PATH, JSON.stringify(archivedDamatosObj), function (err, data) {
      if (err) {
        console.error(err)
        return false
      }
      return true
    })
  })
}

// 保存damato
function damatoSave(damato) {
  fs.writeFile(DAMATO_STORAGE_PATH, JSON.stringify(damato), function (err, data) {
    if (err) {
      console.error(err)
      return false
    }
    return true
  })
}

ipcMain.on('damatoSave', (event, arg) => {
  console.log(arg)
  damatoSave(arg)
  event.returnValue = 'damato saved'
})

// 发送反馈
ipcMain.on('damatoFeedBack', (event, arg) => {
  console.log(arg)
  try {
    emailSender.sendMail('damatofeedback@163.com', 'damato feedback', "942208018@qq.com",
      'damato feedback',
      arg)
    event.returnValue = {
      result: true
    }
  } catch (error) {
    console.log(error.message)
    event.returnValue = {
      result: false,
      reason: "email send failed! please check your network"
    }
  }
})