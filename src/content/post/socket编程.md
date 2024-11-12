---
title: Socket编程
publishDate: 2023-10-18 23:55:10
description: ' socket 编程相关内容 对应计网lab1'
tags:
  - CN
  - socket
language: '中文'
---


# Socket编程

## Socket

$\quad$ 这里给出了一个最简单的连接的例子:

**Server**

```cpp

sock = socket(AF_INET, SOCK_STREAM, 0); // 申请一个TCP的socket

struct sockaddr_in addr; // 描述监听的地址

addr.sin_port = htons(23233); // 在23233端口监听 htons是host to network (short)的简称，表示进行大小端表示法转换，网络中一般使用大端法

addr.sin_family = AF_INET; // 表示使用AF_INET地址族

inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr); // 监听127.0.0.1地址，将字符串表示转化为二进制表示

bind(sock, (struct sockaddr*)&addr, sizeof(addr));

listen(sock, 128);

int client = accept(sock, nullptr, nullptr);

```

  

**Client**

  

```cpp

sock = socket(AF_INET, SOCK_STREAM, 0);

struct sockaddr_in addr;

addr.sin_port = htons(23233);

addr.sin_family = AF_INET;

inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr); // 表示我们要连接到服务器的127.0.0.1:23233

connect(sock, (struct sockaddr*)&addr, sizeof(addr));

```

  

而传输数据我们只需要使用`recv`和`send`进行即可

  

**Server**

  

```cpp

char buffer[128];

size_t l = recv(client, buffer, 128, 0);

send(client, buffer, l, 0);

```

  

**Client**

  

```cpp

char buffer[128];

sprintf(buffer, "Hello Server");

send(sock, buffer, strlen(buffer)+1, 0);

recv(sock, buffer, 128, 0);

```

  

$\quad$ 这个例子描述了Client向Server发送字符串”Hello Server”，Server将数据发回Client的过程。

$\quad$ 但是事实上这样做并不总是正确的，我们可以将send看成是一个缓冲区，这个缓冲区按照固定的速度将内容放到对侧连接的缓冲区中，此时因为已经送达，我们才能将这个缓冲区中已经确认到达的数据清除。调用send的过程等价于我们将要发送的数据拷贝一份放入缓冲区，然后缓冲区会自动发送。但是缓冲区的大小是有限制的，因此调用send并不一定将所有数据都成功放入缓冲区了。

$\quad$ 下面给出了一个保证将所有数据放入缓冲区的例子

  

```cpp

size_t ret = 0;

while (ret < len) {

ssize_t b = send(sock, buffer + ret, len - ret, 0);

if (b == 0) printf("socket Closed"); // 当连接断开

if (b < 0) printf("Error ?"); // 这里可能发生了一些意料之外的情况

ret += b; // 成功将b个byte塞进了缓冲区

}

```

  

接收端同理:

1. 接收缓冲区是有大小限制的

2. 当我们想接收一定长度的数据的时候，这些数据可能只有部分到达了当前机器

  

因此我们也需要像这样接收数据才能获取到我们想要的所有信息

## Pthread

$\quad$ `pthread_create` 函数用于创建一个新的线程，它需要四个参数，包括一个 `pthread_t` 变量用于存储线程，一个 `pthread_attr_t` 变量用于指明线程属性，一个线程初始化函数及该函数的参数。线程初始化函数会在线程执行时被调用。

  

```c

pthread_t thread;

pthread_addr_t thread_attribute;

void thread_function(void *argument);

char* argument;

  

pthread_create(&thread, thread_attribute, (void*)&thread_function, (void*)&argument);

```

$\quad$ 大多数情况下，线程属性参数用来指明最小栈空间，可以使用 `pthread_attr_default` 来使用默认参数, 在未来可能会有更多的用法。与 UNIX 进程的 `fork` 从当前程序的相同位置开始执行不同，线程会从 `pthread_create` 中指明的初始化函数处开始执行。这样做的原因很简单，如果线程也从当前程序位置开始执行，那么可能有多个线程使用相同的 resources 执行同样的指令。

$\quad$ 现在我们知道了如何创建线程。让我们来设计一个多线程应用在 `stdout` 上输出被深爱的 `Hello World` 吧。首先，我们需要两个 `pthread_t` 变量，以及一个初始化函数。我们还需要一个方法来让每个线程打印不同的信息。一个方法是将输出分解成若干字符串，并给每个线程一个不同的字符串作为初始化函数的参数。可以参考以下代码：

  

```c

void print_message_function(void* ptr);

main() {

pthread_t thread1, thread2;

char* message1 = "Hello";

char* message2 = "World";

pthread_create(&thread1, pthread_attr_default, (void*)&print_message_fuction, (void*)message1);

pthread_create(&thread2, pthread_attr_default, (void*)&print_message_fuction, (void*)message2);

exit(0);

}

void print_message_function(void* ptr) {

char* message;

message = (char*)ptr;

printf("%s ", message);

}

```

  

$\quad$ 注意 `print_message_function` 的原型以及在调用时的强制类型转换。这段程序首先通过 `pthread_create` 创建第一个线程，并将 `Hello` 作为初始化参数传入。第二个线程的初始化参数是 `World` 。第一个线程将从 `print_message_function` 的第一行开始执行，它将输出 `Hello` 并退出。一个线程会在离开初始化函数时被关闭，因此第一个线程将会在输出 `Hello` 后关闭。同样的，第二个线程会在输出 `World` 后关闭。尽管这段代码看起来很合理，它实际上存在两个重要的缺陷。

$\quad$ 第一个也是最重要的问题是，线程是并发执行的。因此并不能保证第一个线程先于第二个线程到达 `printf` 函数。因此我们可能会看到 `World Hello` 而不是 `Hello World` 。

$\quad$ 另一个更微妙的问题是，注意到在父线程（最初的线程，尽管每个线程都是一样的，我们仍习惯于这样称呼）中调用了 `exit` 函数。如果父线程在两个子线程执行 `printf` 之前就调用了 `exit` ，那么将不会有任何输出。这是因为 `exit` 函数将退出进程（释放任务），因而将结束所有线程。因此，任一线程，不论是父线程或是子线程，只要调用 `exit` 就将结束所有其他线程和该进程。如果线程希望明确的终止，它必须使用 `pthread_exit` 函数来避免这个问题。

$\quad$ 因此可以看到，我们的 `Hello World` 程序有两个竞争情况。一个是由 `exit` 调用产生的竞争，另一个是由谁先到达 `printf` 产生的竞争。让我们使用一点疯狂的胶水和胶带来解决这些竞争。既然我们希望每个子线程在父线程退出之前完成，让我们在父线程中插入一些延迟来给子线程更多时间。为了保证第一个子线程先执行 `printf` ，让我们在第二次 `pthread_create` 调用前插入一些延迟。这样我们的代码修改为：

  

```c

void print_message_function(void* ptr);

main() {

pthread_t thread1, thread2;

char* message1 = "Hello";

char* message2 = "World";

pthread_create(&thread1, pthread_attr_default, (void*)&print_message_fuction, (void*)message1);

sleep(10);

pthread_create(&thread2, pthread_attr_default, (void*)&print_message_fuction, (void*)message2);

sleep(10);

exit(0);

}

void print_message_function(void* ptr) {

char* message;

message = (char*)ptr;

printf("%s ", message);

pthread_exit(0);

}

```

  

$\quad$ 这段代码能达到我们的目标吗？并不一定。依靠时间上的延迟来执行同步是不安全的。 这里的竞争情况实际上和我们在分布式应用和共享资源中遇到的情况一样。共享资源就是这里的 `stdout` ，分布式计算单元就是这里的三个线程。线程一必须在线程二之前输出到 `stdout` 并且两者都需要在父线程调用 `exit` 前完成工作。

$\quad$ 除了我们试图使用延迟来进行同步之外，我们还犯了另一个错误。 `sleep` 函数和 `exit` 函数一样都作用于进程。当一个线程调用 `sleep` 时，整个进程都将挂起，也就是说所有的线程都将被挂起。因此我们现在的情况实际上和不添加 `sleep` 时完全一样，除了程序会多运行 20 秒。想要使一个线程延时，正确的函数应该是 `pthread_delay_np` （ np 意为 not process ），例如，将一个线程延迟 2 秒可以使用：

  

```c

struct timespec delay;

delay.tv_sec = 2;

delay.tv_nsec = 0;

pthread_delay_np(&delay);

```

  
  

---