﻿using System.Text;
using RT.Servers;
using RT.Util;

namespace KtaneWeb
{
    public sealed partial class KtanePropellerModule
    {
        private HttpResponse pull(HttpRequest req)
        {
            var output = new StringBuilder();
            if (req.Url["dont"] != "1")
            {
                var cmd = new CommandRunner
                {
                    Command = "git pull --rebase",
                    WorkingDirectory = _config.BaseDir
                };
                cmd.StdoutText += str => output.Append(str);
                cmd.StderrText += str => output.Append(str);
                cmd.StartAndWait();
            }
            _moduleInfoCache = null;
            return HttpResponse.PlainText(output.ToString());
        }
    }
}
