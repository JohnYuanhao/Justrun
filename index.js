const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");

//邮件发送方ID及密钥
var mailTransport = nodemailer.createTransport({
  host: "smtp.qq.com",
  secureConnection: true, // 使用SSL方式（安全方式，防止被窃取信息）
  auth: {
    user: "XXXXX@qq.com",//手动替换
    pass: "密钥"//手动替换
  }
});

//邮件内容填充
function options(user, error) {
  return {
    from: '"微软积分" <XXXXXXX@qq.com>',//手动替换
    to: '"警报" <YYYYYYY@qq.com>',//手动替换
    subject: "警告！错误生成",
    text: "警告！错误生成",
    html: user + "</br>" + error
  };
}

// 添加format方法
Date.prototype.format = function (format) {
  if (!format) {
      format = 'yyyy-MM-dd HH:mm:ss';
  }
  // 用0补齐指定位数
  let padNum = function (value, digits) {
      return Array(digits - value.toString().length + 1).join('0') + value;
  };
  // 指定格式字符
  let cfg = {
      yyyy: this.getFullYear(),             // 年
      MM: padNum(this.getMonth() + 1, 2),        // 月
      dd: padNum(this.getDate(), 2),           // 日
      HH: padNum(this.getHours(), 2),          // 时
      mm: padNum(this.getMinutes(), 2),         // 分
      ss: padNum(this.getSeconds(), 2),         // 秒
      fff: padNum(this.getMilliseconds(), 3),      // 毫秒
  };
  return format.replace(/([a-z]|[A-Z])(\1)*/ig, function (m) {
      return cfg[m];
  });
}

function now(){
  return new Date().format('yyyy-MM-dd HH:mm:ss.fff');
}

//工厂函数
function GamePass(user, password, proxy) {
  this.user = user;
  this.password = !!password ? password : this.password;
  this.proxy = !!proxy ? proxy : this.proxy;
  this.args = ["--no-sandbox", "--disable-setuid-sandbox"];
  this.name = "";
  this.time=0;
}

//原型
GamePass.prototype = {
  constructor: GamePass,
  all: function (obj) {
    for (var i in obj) {
      GamePass.prototype[i] = obj[i];
    }
  },
  sedMail: function (user, error) {
    mailTransport.sendMail(options(user, error), function (err, msg) {
      if (err) {
        console.log(now(),":  发送邮件失败！")
      }
      console.log(now(),":  即将退出进程！");
      process.exit();
    });
  },
  login: async function () {
    this.time+=1;
    if(this.time>5){
      console.log(now(),": "+this.user+"登录失败5次，请检查代理是否可用！");
      this.sedMail(this.user, "登录失败5次，请检查代理是否可用！");
      return;
    }
    if (!!this.proxy) {
      this.args.push("--proxy-server=" + this.proxy);
      console.log(now(),":",this.user+":proxy is "+this.proxy);
    } else {
      console.log(now(),":",this.user, "no proxy");
    }
    let _this = this;

    const browser = await puppeteer.launch({
      headless: true,//true为无界面，false为界面显示，docker为无界面
      args: _this.args
    });

    const Phonepage = await browser.newPage();
    const page = await browser.newPage();
    //手机 EDGE浏览器
    Phonepage.setUserAgent(
      "Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft; Lumia 950) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Mobile Safari/537.36 Edge/15.15063"
    );
    //PC EDGE浏览器
    page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/17.17134"
    );

    console.log(now(),":",_this.user, "testing proxy....");
    Phonepage.on("response", function (response) {
      //拦截请求IP地址JSON
      if (response.url() == "https://api.ip.la/en?json") {
        response
          .json()
          .then(function (i) {
            if (i.location.country_code != "US") {
              throw _this.user +
              "The proxy server address is '" +
              i.location.country_code +
              "',Thread will exit";
            } else {
              console.log(now(),":",_this.user, "proxy is nomal")
            }
          })
          .catch(function (i) {
            console.log(now(),":",i);
            _this.sedMail(_this.user, i);
            browser.close();
          });
      }
    });

    page.on("response", function (response) {
      if (response.url().indexOf("personal-info?X-Requested-With=XMLHttpRequest") != -1) {
        response
          .json()
          .then(function (i) {
            console.log(now(),":",i.fullName, "log in successfully");
            _this.name = i.fullName;
          })
      }
    });
    //查询当前IP地址
    await Phonepage.goto("https://api.ip.la/en?json", {
      waitUntil: ["load", "domcontentloaded", "networkidle2"]
    }).catch(function () { });
    //等待页面跳转完毕
    await page.goto("https://login.live.com", {
      waitUntil: ["load", "domcontentloaded", "networkidle2"]
    });
    await page.waitFor(500);
    //输入用户名
    await page.type("#i0116", this.user, {
      delay: 50
    });
    await page.keyboard.press("Enter");
    await page.waitFor(500);
    //输入密码
    await page.type("#i0118", this.password, {
      delay: 50
    });
    await page.waitFor(1000);
    await page.keyboard.press("Enter");
    let error = false;
    await _this.startSearch(page, Phonepage, browser).catch(function (e) {
      console.log(now(),":",e);
      browser.close();
      error = true;
    })
    if (error) {
      await _this.login();
    }
  },
  startSearch: async function (page, Phonepage, browser) {
    let starTime = new Date().getTime();
    while ((new Date().getTime()) - starTime < 30000) {
      if (this.name != "") {
        break;
      }
      await Phonepage.waitFor(5000);
    }
    if (this.name == "") {
      throw this.user + "login timeout...Just try again..."
    }
    //开始搜索随机字符串，PC和手机同时进行
    for (let index = 0; index < 50; index++) {//共50次搜索
      await page.goto(
        "http://www.bing.com/search?q=" +
        Math.random()
          .toString(36)
          .substr(7) +
        "+&go=&qs=n&sk=&form=QBLH"
      );
      await Phonepage.goto(
        "http://www.bing.com/search?q=" +
        Math.random()
          .toString(36)
          .substr(7) +
        "+&go=&qs=n&sk=&form=QBLH"
      );
      await page.waitFor(30000);//等待30S
    }
    console.log(now(),":",this.name, "is completed.");
    await browser.close();
  }
};

//设置全局代理
new GamePass().all({
  proxy: "127.0.0.1:1080"
});

(async function () {
  // 使用范例
  // new GamePass("XXXXXXXX@outlook.com", "密码","127.0.0.1:8888").login();//设置局部代理模板，单账户代理权限可覆盖全局代理
  // new GamePass("XXXXXXXX@outlook.com", "密码").login();//无等待运行
  // await new GamePass("fraction10000@outlook.com", "YUAN929187075hao").login();//等待完成
  // new GamePass("XXXXXXXX@outlook.com", "密码").login();//无等待运行
  // new GamePass("XXXXXXXX@outlook.com", "密码").login();//无等待运行
  // await new GamePass("XXXXXXXX@outlook.com", "密码").login();//等待完成
  // 以上是每三个账户同时运行任务,以此类推

  new GamePass("XXXXX@outlook.com", "YYYYY").login();
  
})()


